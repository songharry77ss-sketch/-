"""Split paper text into overlapping token-windowed chunks."""
from __future__ import annotations
import tiktoken

_enc = tiktoken.get_encoding("cl100k_base")


def chunk_text(text: str, max_tokens: int = 500, overlap: int = 60) -> list[str]:
    """Sliding window over tokens. Returns list of chunk strings."""
    if not text or len(text.strip()) < 50:
        return []
    tokens = _enc.encode(text)
    if len(tokens) <= max_tokens:
        return [text.strip()]
    chunks: list[str] = []
    step = max(1, max_tokens - overlap)
    for start in range(0, len(tokens), step):
        end = start + max_tokens
        sub = _enc.decode(tokens[start:end]).strip()
        if len(sub) >= 100:
            chunks.append(sub)
        if end >= len(tokens):
            break
    return chunks


def estimate_tokens(text: str) -> int:
    return len(_enc.encode(text))
