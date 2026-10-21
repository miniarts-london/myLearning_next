"""Turns text into vectors for similarity search."""
from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class LocalModelEmbedder:
    """all-MiniLM-L6-v2 through Chroma's built-in ONNX runtime: free, runs on this machine,
    no second API key. The model (about 80 MB) is downloaded the first time it's used."""

    def __init__(self) -> None:
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

        self._model = DefaultEmbeddingFunction()

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [list(map(float, v)) for v in self._model(texts)]


class HashEmbedder:
    """A tiny offline stand-in: words (and word pairs) hashed into a fixed-size vector.
    It only matches shared words, but it's deterministic and needs no download, so tests use it."""

    DIMENSIONS = 512

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(t) for t in texts]

    def _one(self, text: str) -> list[float]:
        vector = [0.0] * self.DIMENSIONS
        words = re.findall(r"[a-z0-9]+", text.lower())
        for token in words + [f"{a} {b}" for a, b in zip(words, words[1:])]:
            index = int(hashlib.md5(token.encode()).hexdigest(), 16) % self.DIMENSIONS
            vector[index] += 1.0
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [v / norm for v in vector]


def make_embedder(kind: str) -> Embedder:
    return HashEmbedder() if kind == "hash" else LocalModelEmbedder()
