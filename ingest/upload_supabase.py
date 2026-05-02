"""Upload embedded chunks JSON -> Supabase (papers + chunks tables)."""
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

# Postgres text columns reject the NUL byte.
NUL = chr(0)


def clean_text(s: str | None) -> str | None:
    if not s:
        return s
    # Strip NUL bytes; collapse other invalid surrogates.
    return s.replace(NUL, "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--input",
        default=str(ROOT / "ingest" / "output" / "chunks_embedded.json"),
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
    log.info(f"loaded {len(chunks)} chunks (dim={payload['dim']}, model={payload.get('model')})")

    # ── 1. Upsert papers ────────────────────────────────────────────
    papers_seen: dict[str, dict] = {}
    for c in chunks:
        pid = c["paper_id"]
        if pid in papers_seen:
            continue
        papers_seen[pid] = {
            "id": clean_text(pid),
            "title": clean_text(c.get("title")) or "",
            "abstract": None,
            "doi": clean_text(c.get("doi")),
            "year": c.get("year"),
            "authors": [clean_text(a) for a in (c.get("authors") or [])],
            "source": pid.split(":", 1)[0] if ":" in pid else "unknown",
            "external_url": clean_text(c.get("external_url")) or "",
            "text_source": c.get("text_source"),
        }
    log.info(f"upserting {len(papers_seen)} unique papers...")
    paper_rows = list(papers_seen.values())
    for i in tqdm(range(0, len(paper_rows), args.batch), desc="papers"):
        sb.table("papers").upsert(paper_rows[i : i + args.batch]).execute()

    # ── 2. Insert chunks ────────────────────────────────────────────
    log.info(f"inserting {len(chunks)} chunks...")
    rows = []
    skipped = 0
    for c in chunks:
        text = clean_text(c["chunk_text"])
        if not text or len(text.strip()) < 10:
            skipped += 1
            continue
        rows.append({
            "paper_id": clean_text(c["paper_id"]),
            "chunk_index": c["chunk_index"],
            "chunk_text": text,
            "token_count": None,
            "embedding": c["embedding"],
        })
    if skipped:
        log.info(f"skipped {skipped} empty/invalid chunks")

    for i in tqdm(range(0, len(rows), args.batch), desc="chunks"):
        try:
            sb.table("chunks").upsert(
                rows[i : i + args.batch],
                on_conflict="paper_id,chunk_index",
            ).execute()
        except Exception as e:
            log.error(f"batch {i // args.batch} failed: {e}")
            raise

    log.info("DONE.")


if __name__ == "__main__":
    main()
