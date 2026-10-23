"""Ask this course: an API that indexes course content and answers questions from it.

Only the Next.js app calls this service (server to server, with a shared token). It never
talks to Moodle: Next.js sends the content, fetched with the learner's own Moodle token,
and with each question the list of activities that learner may see."""
from __future__ import annotations

import json
import logging
import secrets
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .answer import Answerer, ClaudeAnswerer, DemoAnswerer
from .config import Settings, load_settings
from .embeddings import make_embedder
from .ratelimit import DailyLimit
from .store import CourseStore, Document

MAX_QUESTION_CHARS = 500
log = logging.getLogger("ask")


class DocumentIn(BaseModel):
    cmid: int = Field(ge=0)
    title: str
    section: str = ""
    href: str
    html: str


class DocumentsIn(BaseModel):
    documents: list[DocumentIn]


class SearchIn(BaseModel):
    query: str
    allowed_cmids: list[int]
    limit: int = Field(default=5, ge=1, le=10)


class AskIn(BaseModel):
    question: str
    user_id: str
    allowed_cmids: list[int]


def create_app(settings: Settings | None = None, store: CourseStore | None = None,
               answerer: Answerer | None = None) -> FastAPI:
    settings = settings or load_settings()
    if not settings.service_token:
        raise RuntimeError("AI_SERVICE_TOKEN is not set. Copy .env.example to .env and fill it in.")
    store = store or CourseStore(settings.chroma_path, make_embedder(settings.embeddings))
    answerer = answerer or (DemoAnswerer() if settings.demo_mode
                            else ClaudeAnswerer(settings.anthropic_api_key, settings.claude_model))
    limits = DailyLimit(settings.daily_question_limit)

    app = FastAPI(title="MyLearning: Ask this course")

    def require_token(authorization: str = Header(default="")) -> None:
        expected = f"Bearer {settings.service_token}"
        if not secrets.compare_digest(authorization.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail="Unauthorised")

    @app.get("/health")
    def health() -> dict:
        return {"ok": True, "demo_mode": settings.demo_mode, "model": None if settings.demo_mode else settings.claude_model}

    @app.get("/courses/{course_id}/index", dependencies=[Depends(require_token)])
    def course_index(course_id: int) -> dict:
        return store.course_status(course_id)

    @app.put("/courses/{course_id}/documents", dependencies=[Depends(require_token)])
    def replace_documents(course_id: int, body: DocumentsIn) -> dict:
        chunks = store.replace_course(course_id, [Document(**d.model_dump()) for d in body.documents])
        return {"chunks": chunks}

    @app.post("/courses/{course_id}/search", dependencies=[Depends(require_token)])
    def search(course_id: int, body: SearchIn) -> dict:
        """Just the search, no answer: the assistant agent in the Next.js app calls this as one of
        its tools and writes the answer itself. Only activities in `allowed_cmids` are searched."""
        query = body.query.strip()
        if not query:
            raise HTTPException(status_code=400, detail="Empty search.")
        found = store.search(course_id, query[:MAX_QUESTION_CHARS], body.allowed_cmids, k=body.limit)
        hits = [h for h in found if h.similarity >= settings.min_similarity]
        log.warning("course %s search: %d of %d chunks used; best similarity %s", course_id, len(hits), len(found),
                    f"{found[0].similarity:.2f}" if found else "n/a")
        return {"results": [
            {"cmid": h.cmid, "title": h.title, "section": h.section, "href": h.href,
             "text": h.text, "similarity": round(h.similarity, 3)}
            for h in hits
        ]}

    @app.post("/courses/{course_id}/ask", dependencies=[Depends(require_token)])
    async def ask(course_id: int, body: AskIn) -> StreamingResponse:
        question = body.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="Type a question first.")
        if len(question) > MAX_QUESTION_CHARS:
            raise HTTPException(status_code=400, detail=f"Keep your question under {MAX_QUESTION_CHARS} characters.")
        if not limits.try_take(body.user_id):
            raise HTTPException(status_code=429, detail=f"You've asked {limits.limit} questions today. Try again tomorrow.")

        found = store.search(course_id, question, body.allowed_cmids)
        hits = [h for h in found if h.similarity >= settings.min_similarity]
        # Shows how close the matches were, to help tune MIN_SIMILARITY. No question text is logged.
        log.warning("course %s: %d of %d chunks used; best similarity %s", course_id, len(hits), len(found),
                    f"{found[0].similarity:.2f}" if found else "n/a")

        # Newline-delimited JSON: the sources first (so they can show straight away), then the answer as it's written.
        async def events() -> AsyncIterator[str]:
            def line(event: dict) -> str:
                return json.dumps(event) + "\n"

            sources, seen = [], set()
            for i, h in enumerate(hits, start=1):
                if h.cmid not in seen:
                    seen.add(h.cmid)
                    sources.append({"n": i, "cmid": h.cmid, "title": h.title, "href": h.href})
            yield line({"type": "sources", "sources": sources, "remaining": limits.remaining(body.user_id)})

            if not hits:
                yield line({"type": "text", "text": "I couldn't find anything about that in this course. Try asking in a different way, or ask your teacher."})
            else:
                try:
                    async for text in answerer.stream(question, hits):
                        yield line({"type": "text", "text": text})
                except Exception:  # noqa: BLE001 - the learner gets a message; the details stay in the server log
                    log.exception("Answering failed")
                    yield line({"type": "error", "message": "Sorry, the answer couldn't be written just now. Try again in a moment."})
            yield line({"type": "done"})

        return StreamingResponse(events(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})

    return app


def get_app() -> FastAPI:
    """Entry point for uvicorn: `uvicorn app.main:get_app --factory`."""
    return create_app()
