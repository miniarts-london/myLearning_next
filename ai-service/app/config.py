"""Settings, read from environment variables (and a .env file in development)."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    service_token: str
    anthropic_api_key: str
    claude_model: str
    daily_question_limit: int
    chroma_path: str
    embeddings: str  # "default" or "hash"
    min_similarity: float  # Chunks less similar to the question than this aren't used

    @property
    def demo_mode(self) -> bool:
        """No API key: show the relevant extracts instead of asking Claude."""
        return not self.anthropic_api_key


def load_settings() -> Settings:
    return Settings(
        service_token=os.environ.get("AI_SERVICE_TOKEN", ""),
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
        claude_model=os.environ.get("CLAUDE_MODEL", "claude-haiku-5-5"),
        daily_question_limit=int(os.environ.get("DAILY_QUESTION_LIMIT", "20")),
        chroma_path=os.environ.get("CHROMA_PATH", "./data/chroma"),
        embeddings=os.environ.get("EMBEDDINGS", "default"),
        min_similarity=float(os.environ.get("MIN_SIMILARITY", "0.2")),
    )
