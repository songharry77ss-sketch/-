"""Session lifecycle + interrogation message endpoints."""
from __future__ import annotations
import json
import logging
from datetime import datetime, timezone
from typing import AsyncIterator
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.config import settings
from app.models import (
    CreateSessionRequest,
    Message,
    SendMessageRequest,
    SessionInfo,
)
from app.services.agent import (
    build_query,
    evaluate_verdict,
    generate_report,
    make_case_no,
    stream_next_question,
)
from app.services.rag import retrieve
from app.services.supa import supabase

log = logging.getLogger("girigo.sessions")
router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionInfo)
def create_session(req: CreateSessionRequest):
    res = (
        supabase()
        .table("sessions")
        .insert({
            "suspect_name": req.suspect_name,
            "relation": req.relation,
            "situation": req.situation,
        })
        .execute()
    )
    if not res.data:
        raise HTTPException(500, "세션 생성 실패")
    row = res.data[0]
    return SessionInfo(**row)


@router.get("/{session_id}", response_model=SessionInfo)
def get_session(session_id: str):
    res = supabase().table("sessions").select("*").eq("id", session_id).single().execute()
    if not res.data:
        raise HTTPException(404, "세션 없음")
    return SessionInfo(**res.data)


def _load_messages(session_id: str) -> list[Message]:
    rows = (
        supabase()
        .table("messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    return [Message(**r) for r in rows]


def _save_message(session_id: str, role: str, content: str, rag_ids: list[int] | None = None):
    supabase().table("messages").insert({
        "session_id": session_id,
        "role": role,
        "content": content,
        "rag_chunks": rag_ids or [],
    }).execute()


@router.post("/{session_id}/messages")
async def send_message(session_id: str, req: SendMessageRequest):
    """User submits an answer; profiler streams the next question.

    On the very first call (no history), `req.content` may be the placeholder
    "[start]" and we'll just stream the opening line.
    """
    sess_res = supabase().table("sessions").select("*").eq("id", session_id).single().execute()
    if not sess_res.data:
        raise HTTPException(404, "세션 없음")
    sess = sess_res.data
    if sess["status"] != "active":
        raise HTTPException(400, "이미 종료된 세션")

    history = _load_messages(session_id)

    # Save user (suspect) answer if not the very first call
    is_first = len(history) == 0 and req.content.strip() in ("", "[start]", "[심문 시작]")
    if not is_first:
        _save_message(session_id, "suspect", req.content.strip())
        history.append(Message(role="suspect", content=req.content.strip()))

    # OPTIMIZATION: Skip RAG entirely on first turn (no dialogue context yet,
    # situation alone gives the profiler enough to ask an opening question).
    # Saves ~200-500ms on the slowest moment of the session (cold start).
    if is_first:
        rag_chunks = []
    else:
        query = build_query(history, sess["situation"])
        rag_chunks = retrieve(query, k=settings().top_k_chunks)
    rag_ids = [c.id for c in rag_chunks]

    # Stream profiler's next question to client
    async def gen() -> AsyncIterator[bytes]:
        acc = ""
        try:
            async for text in stream_next_question(
                sess["suspect_name"],
                sess["relation"],
                sess["situation"],
                history,
                rag_chunks,
            ):
                acc += text
                yield text.encode("utf-8")
        except Exception as e:
            log.exception("stream failed")
            err = f"\n\n[연결 오류: {e}]"
            yield err.encode("utf-8")
            acc += err
        finally:
            if acc.strip():
                _save_message(session_id, "profiler", acc.strip(), rag_ids)

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")


@router.get("/{session_id}/verdict-check")
async def verdict_check(session_id: str):
    """Run a confidence-eval pass after the latest profiler turn.

    Returns whether the agent recommends auto-finalizing the session.
    """
    sess_res = supabase().table("sessions").select("*").eq("id", session_id).single().execute()
    if not sess_res.data:
        raise HTTPException(404, "세션 없음")
    sess = sess_res.data
    history = _load_messages(session_id)

    profiler_turns = sum(1 for m in history if m.role == "profiler")
    s = settings()
    # Don't even evaluate before min turns
    if profiler_turns < s.min_turns:
        return {
            "should_finalize": False,
            "confidence": 0,
            "verdict": "PARTIAL",
            "notes": f"진행 {profiler_turns}/{s.min_turns}",
            "profiler_turns": profiler_turns,
        }

    analysis = await evaluate_verdict(
        sess["suspect_name"], sess["relation"], sess["situation"], history,
    )

    # Hard stop at max_turns
    finalize = analysis.should_finalize or profiler_turns >= s.max_turns
    return {
        "should_finalize": finalize,
        "confidence": analysis.confidence,
        "verdict": analysis.verdict,
        "notes": analysis.notes,
        "profiler_turns": profiler_turns,
    }


@router.post("/{session_id}/report")
async def make_report(session_id: str):
    """Finalize: generate report, mark session closed, return report."""
    sess_res = supabase().table("sessions").select("*").eq("id", session_id).single().execute()
    if not sess_res.data:
        raise HTTPException(404, "세션 없음")
    sess = sess_res.data
    if sess["status"] == "closed" and sess.get("report"):
        return {"case_no": sess.get("case_no") or make_case_no(), **sess["report"]}

    history = _load_messages(session_id)
    if not history:
        raise HTTPException(400, "대화가 없습니다")

    # Aggregate RAG: gather chunks used across the session
    chunk_id_set: set[int] = set()
    for m in history:
        for cid in m.rag_chunks or []:
            chunk_id_set.add(cid)

    techniques_chunks = []
    if chunk_id_set:
        rows = (
            supabase()
            .table("chunks")
            .select("id,paper_id,chunk_text,papers(title,authors,year)")
            .in_("id", list(chunk_id_set))
            .limit(15)
            .execute()
            .data
            or []
        )
        from app.models import RagChunk
        for r in rows:
            p = r.get("papers") or {}
            techniques_chunks.append(
                RagChunk(
                    id=r["id"],
                    paper_id=r["paper_id"],
                    title=p.get("title", ""),
                    authors=p.get("authors") or [],
                    year=p.get("year"),
                    similarity=0.0,
                    chunk_text=r["chunk_text"][:1000],
                )
            )

    report_dict = await generate_report(
        sess["suspect_name"], sess["relation"], sess["situation"], history, techniques_chunks
    )

    case_no = make_case_no()
    supabase().table("sessions").update({
        "status": "closed",
        "verdict": report_dict.get("verdict"),
        "confidence": report_dict.get("credibility"),
        "report": report_dict,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", session_id).execute()

    return {"case_no": case_no, **report_dict}
