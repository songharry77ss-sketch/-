"""RAG retrieval over Supabase pgvector."""
from __future__ import annotations
import logging
from app.config import settings
from app.models import RagChunk
from app.services.supa import supabase
from app.services.embed import embed_query

log = logging.getLogger("girigo.rag")


def retrieve(query: str, k: int | None = None) -> list[RagChunk]:
    """Embed the query and return top-k chunks ranked by cosine similarity."""
    s = settings()
    top_k = k or s.top_k_chunks
    qvec = embed_query(query)
    try:
        res = supabase().rpc(
            "match_chunks",
            {"query_embedding": qvec, "match_count": top_k},
        ).execute()
    except Exception as e:
        log.warning(f"match_chunks RPC failed: {e}")
        return []
    rows = res.data or []
    out: list[RagChunk] = []
    for r in rows:
        out.append(
            RagChunk(
                id=r["id"],
                paper_id=r["paper_id"],
                title=r.get("title") or "",
                authors=r.get("authors") or [],
                year=r.get("year"),
                similarity=r.get("similarity") or 0.0,
                chunk_text=r["chunk_text"][: s.chunk_summary_chars],
            )
        )
    return out


def format_context(chunks: list[RagChunk]) -> str:
    """Format retrieved chunks into a system-prompt-ready block."""
    if not chunks:
        return ""
    parts = ["[관련 전문 기법 및 연구]\n"]
    for i, c in enumerate(chunks, 1):
        authors = ", ".join(c.authors[:3])
        if len(c.authors) > 3:
            authors += " 외"
        cite = f"{authors} ({c.year})" if c.year else authors
        parts.append(f"[{i}] {c.title} — {cite}")
        parts.append(f"    {c.chunk_text}")
        parts.append("")
    return "\n".join(parts)
