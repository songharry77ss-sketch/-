"""Quick smoke test that Voyage API key works."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import voyageai

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

key = os.environ.get("VOYAGE_API_KEY")
if not key:
    sys.exit("VOYAGE_API_KEY missing")

vo = voyageai.Client(api_key=key)
result = vo.embed(
    ["거짓말 탐지 기법", "Reid technique nine steps"],
    model="voyage-3",
    input_type="document",
)
print(f"OK · model=voyage-3 · vectors={len(result.embeddings)} · dim={len(result.embeddings[0])} · tokens={result.total_tokens}")
