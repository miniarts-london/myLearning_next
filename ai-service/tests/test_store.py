from app.store import Document


def test_finds_the_relevant_activity(store):
    hits = store.search(2, "What contrast ratio does normal text need?", allowed_cmids=[11, 13, 21])
    assert hits[0].cmid == 21
    assert hits[0].href == "/courses/2/activities/21"


def test_never_returns_activities_the_learner_cannot_see(store):
    hits = store.search(2, "secret exam answer contrast trick", allowed_cmids=[11, 13, 21], k=10)
    assert 99 not in {h.cmid for h in hits}
    assert store.search(2, "anything", allowed_cmids=[]) == []


def test_only_searches_the_given_course(store):
    assert store.search(3, "contrast ratio", allowed_cmids=[21]) == []


def test_replacing_a_course_removes_old_chunks(store):
    store.replace_course(2, [Document(cmid=11, title="New page", section="S", href="/x", html="<p>Only this now.</p>")])
    status = store.course_status(2)
    assert status["cmids"] == [11]
    assert status["indexed"] and status["indexed_at"]
    assert store.course_status(5) == {"indexed": False, "cmids": [], "indexed_at": None, "chunks": 0}


def test_similarity_is_on_a_0_to_1_scale_whatever_chroma_uses(store):
    hits = store.search(2, "contrast ratio normal text", allowed_cmids=[11, 13, 21])
    assert all(-1.0 <= h.similarity <= 1.0 for h in hits)
    assert hits == sorted(hits, key=lambda h: h.similarity, reverse=True)
    assert hits[0].cmid == 21 and hits[0].similarity > 0.2
