"""Supabase client (service-role) wrapper."""
from __future__ import annotations
from functools import lru_cache
from supabase import create_client, Client
from app.config import settings


@lru_cache(maxsize=1)
def supabase() -> Client:
    s = settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)
