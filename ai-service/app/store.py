"""The search index: course content chunks in Chroma, tagged with the course and activity they came from."""
from __future__ import annotations

import math
import time
from dataclasses import dataclass

import chromadb

from .chunking import chunk_text, html_to_text
from .embeddings import Embedder


@dataclass
class Document:
    cmid: int     # Moodle activity id; 0 for course- or section-level text
    title: str    # e.g. the activity or section name
    section: str  # Section name, for context
    href: str     # Where it lives in the Next.js app
    html: str     # The content, as Moodle sends it


@dataclass
class Hit:
    text: str
    cmid: int
    title: str
    section: str
    href: str
    similarity: float  # Cosine similarity to the question: about 0 = unrelated, 1 = the same meaning


class CourseStore:
    def __init__(self, path: str, embedder: Embedder) -> None:
        self._client = chromadb.PersistentClient(path=path)
        # Vectors are made by our embedder, not by Chroma, so no embedding function is attached.
        self._chunks = self._client.get_or_create_collection(
            "course_chunks", embedding_function=None, metadata={"hnsw:space": "cosine"}
        )
        self._embedder = embedder

    def replace_course(self, course_id: int, documents: list[Document]) -> int:
        """Re-indexes a course from scratch. Returns the number of chunks stored."""
        self._chunks.delete(where={"course_id": course_id})
        ids, texts, metadatas = [], [], []
        indexed_at = int(time.time())
        for doc in documents:
            body = html_to_text(doc.html)
            for n, chunk in enumerate(chunk_text(body)):
                # The title and section go into the searchable text too: "the audit" should find
                # chunks from "Assignment: Accessibility audit".
                ids.append(f"{course_id}:{doc.cmid}:{doc.title}:{n}")
                texts.append(f"{doc.title}\n{chunk}")
                metadatas.append({
                    "course_id": course_id, "cmid": doc.cmid, "title": doc.title,
                    "section": doc.section, "href": doc.href, "indexed_at": indexed_at,
                })
        if ids:
            self._chunks.add(ids=ids, documents=texts, metadatas=metadatas, embeddings=self._embedder.embed(texts))
        return len(ids)

    def course_status(self, course_id: int) -> dict:
        found = self._chunks.get(where={"course_id": course_id}, include=["metadatas"])
        metadatas = found["metadatas"] or []
        return {
            "indexed": bool(metadatas),
            "cmids": sorted({int(m["cmid"]) for m in metadatas}),
            "indexed_at": max((int(m["indexed_at"]) for m in metadatas), default=None),
            "chunks": len(metadatas),
        }

    def search(self, course_id: int, question: str, allowed_cmids: list[int], k: int = 6) -> list[Hit]:
        """The `k` chunks closest to the question, from this course and only from activities
        this learner can see (`allowed_cmids`, worked out by the Next.js app from Moodle)."""
        if not allowed_cmids:
            return []
        question_vector = self._embedder.embed([question])[0]
        result = self._chunks.query(
            query_embeddings=[question_vector],
            n_results=k,
            where={"$and": [{"course_id": course_id}, {"cmid": {"$in": allowed_cmids}}]},
            include=["documents", "metadatas", "embeddings"],
        )
        # Similarity is worked out here rather than taken from Chroma's distances, whose scale
        # depends on the Chroma version and index settings (cosine, L2…). This is always 0–1-ish.
        q = question_vector
        hits = []
        for text, meta, vector in zip(result["documents"][0], result["metadatas"][0], result["embeddings"][0]):
            hits.append(Hit(text=text, cmid=int(meta["cmid"]), title=str(meta["title"]),
                            section=str(meta["section"]), href=str(meta["href"]),
                            similarity=_cosine(q, list(vector))))
        return sorted(hits, key=lambda h: h.similarity, reverse=True)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norms = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norms if norms else 0.0
