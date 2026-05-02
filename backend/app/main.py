"""FastAPI app entrypoint."""
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import sessions

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
)

app = FastAPI(
    title="Girigo Truth Protocol",
    description="AI 거짓말 탐지 프로파일러 (RAG + Claude Opus 4.7)",
    version="2.0.0",
)


@app.on_event("startup")
def _startup():
    # Will raise on missing env vars
    settings()
    # Note: embedding model loads lazily on first query (avoids blocking startup
    # past Railway's healthcheck window).


# CORS
_origins_env = os.environ.get("CORS_ORIGINS", "")
origins = [o.strip() for o in _origins_env.split(",") if o.strip()] or [
    "http://localhost:3000",
    "https://*.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "girigo",
        "version": "2.0.0",
        "status": "ok",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(sessions.router)
