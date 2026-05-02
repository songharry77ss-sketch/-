"""Upload embedded chunks JSON → Supabase (papers + chunks tables).

Run after `run.py` completes and after Supabase schema is applied.
"""
from __future__ import annotations
import argparse
import json
import logging
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from tqdm import tqdm
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)
log = logging.getLogger("girigo.upload")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--input",
        default=str(ROOT / "ingest" / "output" / "chunks_embedded.json"),
        help="Path to embedded chunks JSON",
    )
    ap.add_argument("--batch", type=int, default=50)
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required")

    sb = create_client(url, key)

    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    chunks = payload["chunks"]
    log.info(f"loaded {len(chunks)} chunks (dim={payload['dim']}, model={payload['model']})")

    # ── 1. Upsert papers (one row per unique paper_id) ──
    papers_seen: dict[str, dict] = {}
    for c in chunks:
        pid = c["paper_id"]
        if pid in papers_seen:
            continue
        papers_seen[pid] = {
            "id": pid,
            "title": c.get("title") or "",
            "abstract": None,
            "doi": c.get("doi"),
            "year": c.get("year"),
            "authors": c.get("authors") or [],
            "source": pid.split(":", 1)[0] if ":" in pid else "unknown",
            "external_url": c.get("external_url") or "",
            "text_source": c.get("text_source"),
        }
    log.info(f"upserting {len(papers_seen)} unique papers...")
    paper_rows = list(papers_seen.values())
    for i in tqdm(range(0, len(paper_rows), args.batch), desc="papers"):
        sb.table("papers").upsert(paper_rows[i : i + args.batch]).execute()

    # ── 2. Insert chunks (skip duplicates via unique paper_id+chunk_index) ──
    log.info(f"inserting {len(chunks)} chunks...")
    rows = [
        {
            "paper_id": c["paper_id"],
            "chunk_index": c["chunk_index"],
            "chunk_text": c["chunk_text"],
            "token_count": None,
            "embedding": c["embedding"],
        }
        for c in chunks
    ]
    for i in tqdm(range(0, len(rows), args.batch), desc="chunks"):
        sb.table("chunks").upsert(
            rows[i : i + args.batch],
            on_conflict="paper_id,chunk_index",
        ).execute()

    log.info("DONE.")
    log.info("Run the IVFFLAT index ANALYZE in Supabase SQL editor:")
    log.info("  ANALYZE chunks;")


if __name__ == "__main__":
    main()
