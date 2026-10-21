"""Turns Moodle HTML into plain text, then into overlapping chunks small enough to search well."""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

BLOCKS = ["p", "li", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "blockquote", "dt", "dd"]


def html_to_text(html: str) -> str:
    """Keeps the structure that matters for meaning: one block (paragraph, list item, heading…) per line."""
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    for li in soup.find_all("li"):
        li.insert(0, "- ")
    for tag in soup.find_all(BLOCKS):
        tag.append("\n")
    text = soup.get_text()
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def chunk_text(text: str, max_chars: int = 1200, overlap: int = 200) -> list[str]:
    """Splits on line boundaries into chunks of up to `max_chars`, each starting with the last
    `overlap` characters of the one before, so an idea split across two chunks is still found."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    current = ""
    for line in text.split("\n"):
        # A single very long line is cut on word boundaries.
        while len(line) > max_chars:
            cut = line.rfind(" ", 0, max_chars)
            cut = cut if cut > 0 else max_chars
            piece, line = line[:cut], line[cut:].strip()
            if current:
                chunks.append(current)
                current = current[-overlap:]
            chunks.append((current + "\n" + piece).strip() if current else piece)
            current = piece[-overlap:]
        if len(current) + len(line) + 1 > max_chars and current:
            chunks.append(current)
            current = current[-overlap:]
        current = (current + "\n" + line).strip() if current else line
    if current and (not chunks or current != chunks[-1][-len(current):]):
        chunks.append(current)
    return chunks
