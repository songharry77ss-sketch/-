"""Local embedding via sentence-transformers (multilingual-e5-large, 1024-dim).

No API key needed. Runs on CPU. Model is ~1.3 GB downloaded once and cached.
"""
from __future__ import annotations
import logging
from typing import Sequence

log = logging.getLogger("girigo.embed")

# Multilingual E5-large: 1024 dimensions (matches our pgvector schema).
# E5 family expects "passage: " prefix for documents and "query: " for queries.
MODEL_NAME = "intfloat/multilingual-e5-large"  # 1024-dim, matches schema

_model = None


def _load():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer  # imported lazily
        log.info(f"loading {MODEL_NAME} (one-time download ~1.3 GB on first run)...")
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_documents(texts: Sequence[str], batch_size: int = 32) -> tuple[list[list[float]], int]:
    if not texts:
        return [], 0
    model = _load()
    # E5 documents: "passage: " prefix
    prefixed = [f"passage: {t}" for t in texts]
    vectors = model.encode(
        prefixed,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    return vectors.tolist(), 0  # token count irrelevant locally


def embed_query(text: str) -> tuple[list[float], int]:
    model = _load()
    vec = model.encode([f"query: {text}"], convert_to_numpy=True, normalize_embeddings=True)[0]
    return vec.tolist(), 0
