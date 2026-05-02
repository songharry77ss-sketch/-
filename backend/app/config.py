"""Centralized config from environment variables."""
import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel

# Load .env from project root if present (for local dev)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Settings(BaseModel):
    anthropic_api_key: str
    voyage_api_key: str
    supabase_url: str
    supabase_service_role_key: str
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://*.vercel.app",
    ]

    # Agent loop
    min_turns: int = 4
    max_turns: int = 14
    confidence_threshold: int = 82  # 0-100, stop when reached

    # RAG
    top_k_chunks: int = 5
    chunk_summary_chars: int = 1200  # truncate long retrieved chunks


@lru_cache(maxsize=1)
def settings() -> Settings:
    def req(name: str) -> str:
        v = os.environ.get(name, "").strip()
        if not v:
            raise RuntimeError(f"Missing env var: {name}")
        return v

    return Settings(
        anthropic_api_key=req("ANTHROPIC_API_KEY"),
        voyage_api_key=req("VOYAGE_API_KEY"),
        supabase_url=req("SUPABASE_URL"),
        supabase_service_role_key=req("SUPABASE_SERVICE_ROLE_KEY"),
    )
