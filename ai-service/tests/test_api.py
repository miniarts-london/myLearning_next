import json

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import AUTH, settings


def events(response) -> list[dict]:
    return [json.loads(line) for line in response.text.splitlines() if line]


def ask(client, question, allowed=(0, 11, 13, 21), user="5"):
    return client.post("/courses/2/ask", headers=AUTH,
                       json={"question": question, "user_id": user, "allowed_cmids": list(allowed)})


def test_every_endpoint_except_health_needs_the_token(client):
    assert client.get("/health").status_code == 200
    assert client.get("/courses/2/index").status_code == 401
    assert client.get("/courses/2/index", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post("/courses/2/ask", json={"question": "q", "user_id": "5", "allowed_cmids": [11]}).status_code == 401


def test_indexing_and_status(client):
    response = client.put("/courses/7/documents", headers=AUTH, json={"documents": [
        {"cmid": 1, "title": "Feeding", "section": "Care", "href": "/courses/7/activities/1", "html": "<p>Feed little and often.</p>"},
    ]})
    assert response.json() == {"chunks": 1}
    status = client.get("/courses/7/index", headers=AUTH).json()
    assert status["indexed"] is True and status["cmids"] == [1]


def test_asking_streams_sources_then_the_answer(client, answerer):
    response = ask(client, "What contrast ratio does normal text need?")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    stream = events(response)
    assert stream[0]["type"] == "sources"
    assert stream[0]["sources"][0] == {"n": 1, "cmid": 21, "title": "Contrast ratios", "href": "/courses/2/activities/21"}
    assert stream[0]["remaining"] == 19
    text = "".join(e["text"] for e in stream if e["type"] == "text")
    assert text.startswith("Answer from: Contrast ratios")
    assert stream[-1] == {"type": "done"}


def test_restricted_content_never_reaches_the_answer(client, answerer):
    ask(client, "What is the secret exam answer?")
    for _question, hits in answerer.calls:
        assert all(h.cmid != 99 for h in hits)


def test_nothing_relevant_gives_an_honest_answer_without_calling_claude(client, answerer):
    stream = events(ask(client, "zebra migration patterns serengeti"))
    text = "".join(e["text"] for e in stream if e["type"] == "text")
    assert "couldn't find anything about that in this course" in text
    assert answerer.calls == []


def test_questions_are_checked(client):
    assert ask(client, "   ").status_code == 400
    assert ask(client, "x" * 501).status_code == 400


def test_daily_limit_per_learner(store, answerer):
    client = TestClient(create_app(settings(daily_question_limit=2), store=store, answerer=answerer))
    assert ask(client, "contrast", user="5").status_code == 200
    assert ask(client, "contrast", user="5").status_code == 200
    limited = ask(client, "contrast", user="5")
    assert limited.status_code == 429
    assert "2 questions today" in limited.json()["detail"]
    assert ask(client, "contrast", user="6").status_code == 200  # Other learners aren't affected


def test_a_failing_answer_ends_the_stream_politely(store):
    class Broken:
        async def stream(self, question, hits):
            raise RuntimeError("API down")
            yield ""  # pragma: no cover

    client = TestClient(create_app(settings(), store=store, answerer=Broken()))
    stream = events(ask(client, "contrast ratio"))
    assert stream[-2]["type"] == "error"
    assert stream[-1] == {"type": "done"}


def test_demo_mode_without_an_api_key(store):
    client = TestClient(create_app(settings(anthropic_api_key=""), store=store))
    assert client.get("/health").json()["demo_mode"] is True
    text = "".join(e["text"] for e in events(ask(client, "contrast ratio normal text")) if e["type"] == "text")
    assert text.startswith("Demo mode")
    assert "4.5:1" in text


def test_the_prompt_keeps_extracts_separate_from_the_question():
    from app.answer import SYSTEM_PROMPT, build_prompt
    from app.store import Hit

    prompt = build_prompt("What is WCAG?", [Hit("WCAG text", 11, "Accessibility and WCAG", "Intro", "/x", 0.9)])
    assert prompt.startswith("<course_extracts>\n[1] From \"Accessibility and WCAG\"")
    assert prompt.endswith("Learner's question: What is WCAG?")
    assert "not instructions" in SYSTEM_PROMPT


def test_refuses_to_start_without_a_service_token(store):
    import pytest

    with pytest.raises(RuntimeError, match="AI_SERVICE_TOKEN"):
        create_app(settings(service_token=""), store=store)


def search(client, query, allowed=(0, 11, 13, 21), limit=5):
    return client.post("/courses/2/search", headers=AUTH, json={"query": query, "allowed_cmids": list(allowed), "limit": limit})


def test_search_returns_matching_chunks_without_calling_claude(client, answerer):
    response = search(client, "What contrast ratio does normal text need?")
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[0]["cmid"] == 21
    assert results[0]["href"] == "/courses/2/activities/21"
    assert "4.5:1" in results[0]["text"]
    assert 0 < results[0]["similarity"] <= 1
    assert answerer.calls == []  # Search only: no answer written, no cost


def test_search_respects_allowed_activities_and_auth(client):
    results = search(client, "secret exam answer contrast", allowed=(11, 13, 21)).json()["results"]
    assert all(r["cmid"] != 99 for r in results)
    assert client.post("/courses/2/search", json={"query": "q", "allowed_cmids": [11]}).status_code == 401
    assert search(client, "   ").status_code == 400
    assert search(client, "contrast", limit=50).status_code == 422  # At most 10 results
