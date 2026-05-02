"""Voyage AI embedding client."""
from __future__ import annotations
from functools import lru_cache
import voyageai
from app.config import settings


@lru_cache(maxsize=1)
def voyage() -> voyageai.Client:
    return voyageai.Client(api_key=settings().voyage_api_key)


def embed_query(text: str) -> list[float]:
    res = voyage().embed([text], model="voyage-3", input_type="query")
    return res.embeddings[0]
