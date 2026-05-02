"""Profiler agent — orchestrates Claude + RAG + verdict tracking."""
from __future__ import annotations
import json
import logging
import random
import string
from typing import AsyncIterator
import anthropic
from app.config import settings
from app.models import Message, RagChunk, TurnAnalysis
from app.prompts.profiler import (
    PROFILER_SYSTEM,
    REPORT_PROMPT,
    REPORT_SCHEMA,
    VERDICT_TOOL_SCHEMA,
)
from app.services.rag import format_context, retrieve

log = logging.getLogger("girigo.agent")
MODEL = "claude-opus-4-7"


def claude() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=settings().anthropic_api_key)


def build_query(messages: list[Message], situation: str) -> str:
    """Build a RAG query from the most recent context."""
    recent = messages[-4:] if len(messages) > 4 else messages
    parts = [situation]
    for m in recent:
        parts.append(m.content)
    return " ".join(parts)[:1500]


def build_system(suspect_name: str, relation: str, situation: str, rag_chunks: list[RagChunk]) -> str:
    base = PROFILER_SYSTEM.format(
        suspect_name=suspect_name,
        relation=relation,
        situation=situation,
    )
    ctx = format_context(rag_chunks)
    if ctx:
        return base + "\n\n" + ctx
    return base


def history_to_anthropic(messages: list[Message]) -> list[dict]:
    out: list[dict] = []
    for m in messages:
        out.append({
            "role": "assistant" if m.role == "profiler" else "user",
            "content": m.content,
        })
    return out


async def stream_next_question(
    suspect_name: str,
    relation: str,
    situation: str,
    history: list[Message],
    rag_chunks: list[RagChunk],
) -> AsyncIterator[str]:
    """Yield text deltas as the profiler types the next question."""
    sys_prompt = build_system(suspect_name, relation, situation, rag_chunks)
    msgs = history_to_anthropic(history)
    if not msgs:
        msgs = [{"role": "user", "content": "[심문 시작 — 첫 질문을 해주십시오]"}]

    async with claude().messages.stream(
        model=MODEL,
        max_tokens=600,
        system=sys_prompt,
        messages=msgs,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def evaluate_verdict(
    suspect_name: str,
    relation: str,
    situation: str,
    history: list[Message],
) -> TurnAnalysis:
    """Ask Claude to score current state via tool call. Used to decide auto-stop."""
    sys = (
        f"당신은 행동 분석 전문가. 아래 심문 녹취를 검토하여 record_verdict 도구를 호출한다. "
        f"대상: {suspect_name} ({relation}). 정황: {situation}"
    )
    transcript_blocks: list[dict] = [
        {"role": "user", "content": "녹취록을 검토하고 판정 도구를 호출해주십시오."}
    ]

    transcript_text = "\n".join(
        f"[{'프로파일러' if m.role == 'profiler' else suspect_name}] {m.content}"
        for m in history
    )
    transcript_blocks[0]["content"] = (
        f"녹취록:\n\n{transcript_text}\n\n위 녹취록을 검토하고 record_verdict 도구를 호출하라."
    )

    res = await claude().messages.create(
        model=MODEL,
        max_tokens=400,
        system=sys,
        tools=[VERDICT_TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "record_verdict"},
        messages=transcript_blocks,
    )
    for block in res.content:
        if block.type == "tool_use" and block.name == "record_verdict":
            data = block.input
            return TurnAnalysis(**data)
    # Fallback (shouldn't happen with forced tool_choice)
    return TurnAnalysis(
        confidence=50,
        verdict="PARTIAL",
        should_finalize=False,
        notes="평가 실패",
    )


async def generate_report(
    suspect_name: str,
    relation: str,
    situation: str,
    history: list[Message],
    techniques_chunks: list[RagChunk],
) -> dict:
    """Generate the final report. Returns dict matching REPORT_SCHEMA."""
    transcript = "\n\n".join(
        f"[{'프로파일러' if m.role == 'profiler' else suspect_name}] {m.content}"
        for m in history
    )
    tech_block = format_context(techniques_chunks) or "(없음)"
    prompt = REPORT_PROMPT.format(
        suspect_name=suspect_name,
        relation=relation,
        situation=situation,
        transcript=transcript,
        techniques_block=tech_block,
    )

    res = await claude().messages.create(
        model=MODEL,
        max_tokens=4096,
        tools=[
            {
                "name": "submit_report",
                "description": "최종 보고서 제출",
                "input_schema": REPORT_SCHEMA,
            }
        ],
        tool_choice={"type": "tool", "name": "submit_report"},
        messages=[{"role": "user", "content": prompt}],
    )
    for block in res.content:
        if block.type == "tool_use" and block.name == "submit_report":
            return dict(block.input)  # type: ignore[arg-type]
    raise RuntimeError("보고서 생성 실패")


def make_case_no() -> str:
    digits = "".join(random.choices(string.digits, k=5))
    letters = "".join(random.choices(string.ascii_uppercase, k=2))
    return f"K-{digits}-{letters}"
