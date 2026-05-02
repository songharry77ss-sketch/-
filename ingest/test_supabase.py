"""Verify Supabase connection + schema."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(url, key)

# Probe each table
tables = ["papers", "chunks", "sessions", "messages"]
print(f"connecting to {url}")
for t in tables:
    try:
        r = sb.table(t).select("*", count="exact").limit(1).execute()
        print(f"  ✓ {t:10} · count={r.count if hasattr(r, 'count') else '?'}")
    except Exception as e:
        print(f"  ✗ {t:10} · {e}")

# Probe pgvector RPC by sending a dummy 1024-dim vector
try:
    dummy = [0.0] * 1024
    r = sb.rpc("match_chunks", {"query_embedding": dummy, "match_count": 1}).execute()
    print(f"  ✓ match_chunks RPC · returned {len(r.data or [])} rows")
except Exception as e:
    print(f"  ✗ match_chunks · {e}")
