"""Batch-embed chunks via Voyage 3."""
from __future__ import annotations
import os
import time
import logging
import voyageai

log = logging.getLogger("girigo.embed")

_client: voyageai.Client | None = None


def client() -> voyageai.Client:
    global _client
    if _client is None:
        key = os.environ.get("VOYAGE_API_KEY")
        if not key:
            raise RuntimeError("VOYAGE_API_KEY missing")
        _client = voyageai.Client(api_key=key)
    return _client


def embed_documents(texts: list[str], batch_size: int = 96) -> tuple[list[list[float]], int]:
    """Embed a list of texts. Returns (vectors, total_tokens). Retries on transient errors."""
    if not texts:
        return [], 0
    out: list[list[float]] = []
    total_tokens = 0
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        for attempt in range(4):
            try:
                res = client().embed(batch, model="voyage-3", input_type="document")
                out.extend(res.embeddings)
                total_tokens += res.total_tokens
                break
            except Exception as e:
                wait = 2 ** attempt
                log.warning(f"embed batch {i//batch_size} attempt {attempt+1} failed: {e}; wait {wait}s")
                time.sleep(wait)
        else:
            raise RuntimeError(f"embed batch {i//batch_size} failed after retries")
    return out, total_tokens


def embed_query(text: str) -> tuple[list[float], int]:
    """Embed a single query (use input_type='query' for retrieval asymmetry)."""
    res = client().embed([text], model="voyage-3", input_type="query")
    return res.embeddings[0], res.total_tokens
