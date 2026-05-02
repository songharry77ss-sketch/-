// Frontend → FastAPI backend client.
// Base URL from NEXT_PUBLIC_API_URL (default: localhost:8000).

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Relation = "연인" | "배우자" | "친구" | "가족" | "동료" | "사제";
export type Verdict = "TRUTHFUL" | "PARTIAL" | "EVASIVE" | "DECEPTIVE";

export interface SessionInfo {
  id: string;
  suspect_name: string;
  relation: Relation;
  situation: string;
  status: "active" | "closed";
  verdict?: Verdict | null;
  confidence?: number | null;
  created_at: string;
  finished_at?: string | null;
}

export interface VerdictCheck {
  should_finalize: boolean;
  confidence: number;
  verdict: Verdict;
  notes: string;
  profiler_turns: number;
}

export interface Report {
  case_no: string;
  credibility: number;
  consistency: number;
  evasion: number;
  emotional_baseline: string;
  verdict: Verdict;
  one_line: string;
  red_flags: { quote: string; analysis: string }[];
  consistencies: { quote: string; analysis: string }[];
  techniques_applied: string[];
  citations: { title: string; authors: string[]; year?: number | null }[];
  recommendation: string;
}

async function jsonReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${txt || res.statusText}`);
  }
  return res.json();
}

export const api = {
  createSession(body: { suspect_name: string; relation: Relation; situation: string }) {
    return jsonReq<SessionInfo>("/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getSession(id: string) {
    return jsonReq<SessionInfo>(`/sessions/${id}`);
  },

  /** Stream the next profiler message (text/plain SSE-like). Returns full string when done. */
  async *streamMessage(sessionId: string, content: string): AsyncGenerator<string> {
    const res = await fetch(`${BASE}/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`stream failed: ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  },

  verdictCheck(sessionId: string) {
    return jsonReq<VerdictCheck>(`/sessions/${sessionId}/verdict-check`);
  },

  generateReport(sessionId: string) {
    return jsonReq<Report>(`/sessions/${sessionId}/report`, { method: "POST" });
  },
};
