from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.embeddings import HashEmbedder
from app.main import create_app
from app.store import CourseStore, Document

TOKEN = "test-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


class EchoAnswerer:
    """Stands in for Claude: says which extracts it was given, so tests can check retrieval."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, list]] = []

    async def stream(self, question, hits):
        self.calls.append((question, hits))
        yield "Answer from: "
        yield ", ".join(h.title for h in hits)


def settings(**overrides) -> Settings:
    values = dict(service_token=TOKEN, anthropic_api_key="", claude_model="claude-haiku-5-5",
                  daily_question_limit=20, chroma_path="unused", embeddings="hash", min_similarity=0.2)
    values.update(overrides)
    return Settings(**values)


COURSE = [
    Document(cmid=11, title="Accessibility and WCAG", section="Why accessibility matters", href="/courses/2/activities/11",
             html="<p>WCAG has four principles: perceivable, operable, understandable and robust.</p>"
                  "<p>Public sector websites in the UK must meet WCAG 2.2 AA.</p>"),
    Document(cmid=13, title="Assignment: Accessibility audit", section="Keyboard and screen readers", href="/courses/2/activities/13",
             html="<p>Audit a web page against five WCAG criteria and submit your findings.</p>"),
    Document(cmid=21, title="Contrast ratios", section="Colour and contrast", href="/courses/2/activities/21",
             html="<p>Normal text needs a contrast ratio of at least 4.5:1. Large text needs 3:1.</p>"),
    Document(cmid=99, title="Teacher notes (restricted)", section="Hidden", href="/courses/2/activities/99",
             html="<p>The secret exam answer is purple elephant. Contrast ratio trick question.</p>"),
]


@pytest.fixture
def store(tmp_path) -> CourseStore:
    s = CourseStore(str(tmp_path / "chroma"), HashEmbedder())
    s.replace_course(2, COURSE)
    return s


@pytest.fixture
def answerer() -> EchoAnswerer:
    return EchoAnswerer()


@pytest.fixture
def client(store, answerer) -> TestClient:
    return TestClient(create_app(settings(), store=store, answerer=answerer))
