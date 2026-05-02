"""End-to-end ingest: search → extract → chunk → embed → save.

Saves checkpoints to ingest/cache/ so it can resume on failure.
Run:
    python ingest/run.py --target 200
"""
from __future__ import annotations
import argparse
import json
import logging
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sources import dedupe, search_arxiv, search_openalex, search_semantic_scholar  # noqa: E402
from extract import extract_text  # noqa: E402
from chunk import chunk_text, estimate_tokens  # noqa: E402
from embed import embed_documents  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)
log = logging.getLogger("girigo.run")

CACHE = ROOT / "ingest" / "cache"
CACHE.mkdir(parents=True, exist_ok=True)
OUTPUT = ROOT / "ingest" / "output"
OUTPUT.mkdir(parents=True, exist_ok=True)

# Diverse keyword set covering all major deception detection / interview techniques
QUERIES: list[str] = [
    # Core lab-validated techniques
    "deception detection verbal cues",
    "lie detection interview",
    "Reid technique interrogation",
    "Statement Validity Assessment",
    "Criteria-Based Content Analysis CBCA",
    "Reality Monitoring deception",
    "Scientific Content Analysis SCAN",
    "Cognitive Interview",
    "Behavioral Analysis Interview",
    "Verifiability Approach lying",
    # Adjacent / context techniques
    "investigative interviewing PEACE model",
    "forensic interview credibility",
    "deceptive communication nonverbal",
    "credibility assessment witness",
    "interviewer questioning strategies",
    "false confession interrogation",
    "cognitive load deception",
    # Cross-cultural & population
    "deception detection cross cultural",
    "lie detection adolescents",
    "couples deception relationship",
    "workplace deception",
    "pathological lying psychology",
    # Profiling & psychology
    "criminal profiling FBI behavioral",
    "psychopathy deception manipulation",
    "narcissism interpersonal deception",
    "Dark Triad deception",
]


def search_all(target: int, queries: list[str] | None = None) -> list[dict]:
    """Run every query against every source, dedupe, return."""
    cache_file = CACHE / "papers_search.json"
    if cache_file.exists():
        log.info(f"using cached search results: {cache_file}")
        return json.loads(cache_file.read_text(encoding="utf-8"))

    qs = queries or QUERIES
    all_papers: list[dict] = []
    per_query = max(20, (target * 3) // len(qs))

    for q in qs:
        log.info(f"search: {q!r}  (per-source limit ~{per_query})")
        try:
            s2 = search_semantic_scholar(q, limit=per_query)
            log.info(f"  S2 → {len(s2)}")
            all_papers.extend(s2)
        except Exception as e:
            log.warning(f"  S2 failed: {e}")
        try:
            ax = search_arxiv(q, limit=min(20, per_query))
            log.info(f"  arXiv → {len(ax)}")
            all_papers.extend(ax)
        except Exception as e:
            log.warning(f"  arXiv failed: {e}")
        try:
            oa = search_openalex(q, limit=per_query)
            log.info(f"  OA → {len(oa)}")
            all_papers.extend(oa)
        except Exception as e:
            log.warning(f"  OA failed: {e}")

    deduped = dedupe(all_papers)
    log.info(f"total raw: {len(all_papers)} → after dedupe: {len(deduped)}")

    # Score: papers with non-empty abstract first, then PDFs, then year
    def score(p: dict) -> tuple:
        return (
            bool(p.get("abstract")),       # has abstract
            bool(p.get("pdf_url")),        # has PDF
            p.get("year") or 0,            # newer better
        )
    deduped.sort(key=score, reverse=True)

    cache_file.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    return deduped


def extract_all(papers: list[dict], target: int) -> list[dict]:
    """For each paper, extract text. Stop once we have `target` non-empty."""
    cache_file = CACHE / "papers_text.json"
    if cache_file.exists():
        cached = json.loads(cache_file.read_text(encoding="utf-8"))
        if len(cached) >= target:
            log.info(f"using cached extracted text: {len(cached)} papers")
            return cached

    out: list[dict] = []
    pbar = tqdm(papers, desc="extract", unit="paper")
    for p in pbar:
        if len(out) >= target:
            break
        text, kind = extract_text(p)
        if not text:
            continue
        p2 = dict(p)
        p2["text"] = text
        p2["text_source"] = kind
        p2["text_tokens"] = estimate_tokens(text)
        out.append(p2)
        pbar.set_postfix(have=len(out), kind=kind)
    cache_file.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out


def chunk_all(papers: list[dict]) -> list[dict]:
    """Flatten into chunk records."""
    cache_file = CACHE / "chunks.json"
    if cache_file.exists():
        log.info(f"using cached chunks: {cache_file}")
        return json.loads(cache_file.read_text(encoding="utf-8"))

    chunks: list[dict] = []
    for p in tqdm(papers, desc="chunk"):
        cs = chunk_text(p["text"], max_tokens=500, overlap=60)
        for i, c in enumerate(cs):
            chunks.append({
                "paper_id": p["id"],
                "title": p["title"],
                "year": p.get("year"),
                "authors": p.get("authors", []),
                "doi": p.get("doi"),
                "external_url": p.get("external_url", ""),
                "text_source": p.get("text_source"),
                "chunk_index": i,
                "chunk_text": c,
            })
    log.info(f"total chunks: {len(chunks)}")
    cache_file.write_text(json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
    return chunks


def embed_all(chunks: list[dict]) -> dict:
    """Run Voyage embedding over every chunk. Save vectors + metadata to JSON."""
    out_file = OUTPUT / "chunks_embedded.json"
    if out_file.exists():
        log.info(f"using cached embeddings: {out_file}")
        return json.loads(out_file.read_text(encoding="utf-8"))

    texts = [c["chunk_text"] for c in chunks]
    log.info(f"embedding {len(texts)} chunks via Voyage 3...")
    t0 = time.time()
    vectors, total_tokens = embed_documents(texts)
    dt = time.time() - t0
    log.info(f"done in {dt:.1f}s · tokens used: {total_tokens:,}")

    for c, v in zip(chunks, vectors):
        c["embedding"] = v
    payload = {
        "model": "voyage-3",
        "dim": len(vectors[0]) if vectors else 0,
        "total_tokens": total_tokens,
        "chunks": chunks,
    }
    out_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=200, help="Target paper count")
    ap.add_argument("--max-queries", type=int, default=0, help="0 = use all queries (debug only)")
    ap.add_argument("--skip-embed", action="store_true")
    args = ap.parse_args()

    qs = QUERIES if args.max_queries <= 0 else QUERIES[: args.max_queries]
    log.info(f"=== Stage 1: search ({args.target} target, {len(qs)} queries) ===")
    candidates = search_all(target=args.target, queries=qs)
    log.info(f"candidates: {len(candidates)}")

    log.info(f"=== Stage 2: extract text ===")
    papers = extract_all(candidates, target=args.target)
    log.info(f"papers with text: {len(papers)}")

    log.info(f"=== Stage 3: chunk ===")
    chunks = chunk_all(papers)
    log.info(f"chunks: {len(chunks)}")

    if args.skip_embed:
        log.info("--skip-embed: stopping before embed stage")
        return

    log.info(f"=== Stage 4: embed ===")
    payload = embed_all(chunks)
    log.info(f"DONE. Saved {len(payload['chunks'])} embedded chunks.")
    log.info(f"Output: {OUTPUT / 'chunks_embedded.json'}")
    log.info(f"Total tokens used (Voyage): {payload['total_tokens']:,}")


if __name__ == "__main__":
    main()
