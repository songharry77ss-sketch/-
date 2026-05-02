"""Pydantic request/response models."""
from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

Relation = Literal["연인", "배우자", "친구", "가족", "동료", "사제"]
Verdict = Literal["TRUTHFUL", "PARTIAL", "EVASIVE", "DECEPTIVE"]
Role = Literal["profiler", "suspect"]


class CreateSessionRequest(BaseModel):
    suspect_name: str = Field(min_length=1, max_length=40)
    relation: Relation
    situation: str = Field(min_length=10, max_length=2000)


class SessionInfo(BaseModel):
    id: str
    suspect_name: str
    relation: Relation
    situation: str
    status: Literal["active", "closed"]
    verdict: Optional[Verdict] = None
    confidence: Optional[int] = None
    created_at: datetime
    finished_at: Optional[datetime] = None


class Message(BaseModel):
    role: Role
    content: str
    rag_chunks: list[int] = []
    created_at: Optional[datetime] = None


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class TurnAnalysis(BaseModel):
    """Profiler's internal verdict snapshot after each turn."""
    confidence: int = Field(ge=0, le=100)  # truthfulness probability
    verdict: Verdict
    should_finalize: bool
    notes: str = ""


class RagChunk(BaseModel):
    id: int
    paper_id: str
    title: str
    authors: list[str]
    year: Optional[int]
    similarity: float
    chunk_text: str


class FinalReport(BaseModel):
    case_no: str
    credibility: int = Field(ge=0, le=100)
    consistency: int = Field(ge=0, le=100)
    evasion: int = Field(ge=0, le=100)
    emotional_baseline: str
    verdict: Verdict
    one_line: str
    red_flags: list[dict]
    consistencies: list[dict]
    techniques_applied: list[str]  # which RAG-sourced techniques were used
    citations: list[dict]  # paper title/year/authors of cited chunks
    recommendation: str
