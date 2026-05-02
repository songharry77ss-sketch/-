"""Embedding service — local sentence-transformers model (multilingual-e5-large).

Same model used at indexing time, so query embeddings align with stored vectors.
"""
from __future__ import annotations
import logging

log = logging.getLogger("girigo.embed")

MODEL_NAME = "intfloat/multilingual-e5-large"  # 1024-dim, matches Supabase schema

_model = None


def _load():
    global _model
    if _model is None:
        # Lazy import — large dependency, only load when needed
        from sentence_transformers import SentenceTransformer
        log.info(f"loading {MODEL_NAME}...")
        _model = SentenceTransformer(MODEL_NAME)
        log.info(f"  ready (dim=1024)")
    return _model


def embed_query(text: str) -> list[float]:
    """Embed a single query (uses 'query: ' prefix as required by e5 family)."""
    model = _load()
    vec = model.encode(
        [f"query: {text}"],
        convert_to_numpy=True,
        normalize_embeddings=True,
    )[0]
    return vec.tolist()


def warmup():
    """Optional: call at server startup to pre-load model so first query is fast."""
    _load()
