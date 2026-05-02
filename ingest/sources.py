"""Paper search across Semantic Scholar, arXiv, OpenAlex.

Each source returns Paper dicts with a uniform shape:
    {
      "id": "<unique id>",       # Used for dedupe
      "title": str,
      "abstract": str | None,
      "pdf_url": str | None,
      "doi": str | None,
      "year": int | None,
      "authors": list[str],
      "source": "s2" | "arxiv" | "openalex",
      "external_url": str,        # Landing page URL
    }
"""
from __future__ import annotations
import time
import re
import logging
from typing import Iterable
import httpx
import arxiv

log = logging.getLogger("girigo.sources")

UA = "girigo-research/0.1 (research; mailto:opqrttuj@gmail.com)"


# ─── Semantic Scholar ─────────────────────────────────────────────
def search_semantic_scholar(query: str, limit: int = 50) -> list[dict]:
    """Free public API, ~1 req/s rate limit. Best metadata + open-access PDF."""
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    fields = "title,abstract,openAccessPdf,year,externalIds,authors,url"
    out: list[dict] = []
    offset = 0
    while len(out) < limit:
        page = min(100, limit - len(out))
        try:
            r = httpx.get(
                url,
                params={"query": query, "limit": page, "offset": offset, "fields": fields},
                headers={"User-Agent": UA},
                timeout=30,
            )
            if r.status_code == 429:
                time.sleep(3)
                continue
            r.raise_for_status()
            data = r.json().get("data", [])
        except Exception as e:
            log.warning(f"S2 query failed for {query!r}: {e}")
            break
        if not data:
            break
        for p in data:
            doi = (p.get("externalIds") or {}).get("DOI")
            pid = doi or p.get("paperId") or p.get("url")
            out.append({
                "id": f"s2:{pid}" if pid else None,
                "title": (p.get("title") or "").strip(),
                "abstract": (p.get("abstract") or "").strip() or None,
                "pdf_url": (p.get("openAccessPdf") or {}).get("url"),
                "doi": doi,
                "year": p.get("year"),
                "authors": [a.get("name", "") for a in (p.get("authors") or [])][:8],
                "source": "s2",
                "external_url": p.get("url") or "",
            })
        offset += len(data)
        if len(data) < page:
            break
        time.sleep(1.1)  # gentle on free tier
    return [p for p in out if p["id"] and p["title"]]


# ─── arXiv ────────────────────────────────────────────────────────
def search_arxiv(query: str, limit: int = 50) -> list[dict]:
    client = arxiv.Client(page_size=100, delay_seconds=3.0, num_retries=3)
    search = arxiv.Search(
        query=query,
        max_results=limit,
        sort_by=arxiv.SortCriterion.Relevance,
    )
    out: list[dict] = []
    try:
        for p in client.results(search):
            out.append({
                "id": f"arxiv:{p.entry_id}",
                "title": p.title.strip(),
                "abstract": (p.summary or "").strip() or None,
                "pdf_url": p.pdf_url,
                "doi": p.doi,
                "year": p.published.year if p.published else None,
                "authors": [a.name for a in p.authors][:8],
                "source": "arxiv",
                "external_url": p.entry_id,
            })
    except Exception as e:
        log.warning(f"arXiv query failed for {query!r}: {e}")
    return out


# ─── OpenAlex ─────────────────────────────────────────────────────
def search_openalex(query: str, limit: int = 50) -> list[dict]:
    """Completely free, no key, huge coverage."""
    url = "https://api.openalex.org/works"
    out: list[dict] = []
    page = 1
    while len(out) < limit:
        per_page = min(50, limit - len(out))
        try:
            r = httpx.get(
                url,
                params={
                    "search": query,
                    "per-page": per_page,
                    "page": page,
                    "filter": "type:article",
                },
                headers={"User-Agent": UA},
                timeout=30,
            )
            r.raise_for_status()
            data = r.json().get("results", [])
        except Exception as e:
            log.warning(f"OpenAlex query failed for {query!r}: {e}")
            break
        if not data:
            break
        for p in data:
            doi = (p.get("doi") or "").replace("https://doi.org/", "") or None
            # Reconstruct abstract from inverted_index
            abstract = _reconstruct_inverted(p.get("abstract_inverted_index"))
            pdf_url = None
            best_oa = (p.get("best_oa_location") or {}).get("pdf_url")
            if best_oa:
                pdf_url = best_oa
            authors = [
                (a.get("author") or {}).get("display_name", "")
                for a in (p.get("authorships") or [])
            ][:8]
            pid = doi or p.get("id")
            out.append({
                "id": f"oa:{pid}",
                "title": (p.get("title") or p.get("display_name") or "").strip(),
                "abstract": abstract,
                "pdf_url": pdf_url,
                "doi": doi,
                "year": p.get("publication_year"),
                "authors": authors,
                "source": "openalex",
                "external_url": p.get("id") or "",
            })
        page += 1
        time.sleep(0.2)
        if len(data) < per_page:
            break
    return [p for p in out if p["id"] and p["title"]]


def _reconstruct_inverted(inv: dict | None) -> str | None:
    if not inv:
        return None
    positions: list[tuple[int, str]] = []
    for word, idxs in inv.items():
        for i in idxs:
            positions.append((i, word))
    positions.sort()
    return " ".join(w for _, w in positions) or None


# ─── Dedupe + filter ─────────────────────────────────────────────
def dedupe(papers: Iterable[dict]) -> list[dict]:
    """Dedupe by DOI then by normalized title."""
    seen_doi: set[str] = set()
    seen_title: set[str] = set()
    out: list[dict] = []
    for p in papers:
        doi = (p.get("doi") or "").lower().strip()
        if doi:
            if doi in seen_doi:
                continue
            seen_doi.add(doi)
        title_key = re.sub(r"[^a-z0-9]+", "", (p.get("title") or "").lower())[:80]
        if title_key and title_key in seen_title:
            continue
        seen_title.add(title_key)
        out.append(p)
    return out
