"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, type SessionInfo } from "@/lib/api";
import {
  cancelSpeech,
  createRecognizer,
  isRecognitionSupported,
  isSpeechSupported,
  speakKorean,
  type Recognizer,
} from "@/lib/speech";
import { getBgm } from "@/lib/bgm";

type Msg = { role: "profiler" | "suspect"; content: string };

export default function InterrogationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const [sess, setSess] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuf, setStreamBuf] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [verdictHint, setVerdictHint] = useState<{ confidence: number; turns: number; canFinalize: boolean } | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [bgm, setBgm] = useState({ playing: false, muted: false });
  useEffect(() => {
    const b = getBgm();
    const unsub = b.subscribe(setBgm);
    if (!b.state.playing && !b.state.muted) b.start();
    return () => { unsub(); };
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<Recognizer | null>(null);

  // Load session info
  useEffect(() => {
    if (!sessionId) return;
    api
      .getSession(sessionId)
      .then(setSess)
      .catch(() => router.push("/setup"));
  }, [sessionId, router]);

  // Kick off first profiler message
  useEffect(() => {
    if (sess && messages.length === 0) sendToProfiler("[start]");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sess]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamBuf]);

  // Cleanup
  useEffect(() => () => { cancelSpeech(); try { recRef.current?.abort(); } catch {} }, []);

  async function sendToProfiler(content: string) {
    setStreaming(true);
    setStreamBuf("");
    let acc = "";
    try {
      for await (const chunk of api.streamMessage(sessionId, content)) {
        acc += chunk;
        setStreamBuf(acc);
      }
      setMessages((m) => [...m, { role: "profiler", content: acc }]);
      setStreamBuf("");
      if (voiceOn && acc) speakKorean(acc, { rate: 0.85, pitch: 0.7 });
      // After profiler answers, check if we should finalize
      try {
        const v = await api.verdictCheck(sessionId);
        setVerdictHint({ confidence: v.confidence, turns: v.profiler_turns, canFinalize: v.should_finalize });
        if (v.should_finalize) {
          // Auto-finalize after a 3-second pause for dramatic effect + last sentence to register
          setTimeout(() => finalizeSession(), 3500);
        }
      } catch (e) {
        console.error(e);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "profiler", content: `[연결 오류 — ${e instanceof Error ? e.message : "다시 시도"}]` }]);
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }

  const onSubmit = () => {
    if (!input.trim() || streaming) return;
    if (listening) toggleMic();
    cancelSpeech();
    const ans = input.trim();
    setMessages((m) => [...m, { role: "suspect", content: ans }]);
    setInput("");
    sendToProfiler(ans);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const toggleVoice = () => {
    if (voiceOn) cancelSpeech();
    setVoiceOn((v) => !v);
  };

  const toggleMic = () => {
    if (listening) {
      try { recRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    const r = createRecognizer();
    if (!r) {
      alert("이 브라우저는 음성 입력을 지원하지 않습니다. (Chrome/Edge 권장)");
      return;
    }
    recRef.current = r;
    let baseline = input;
    r.onresult = (e: any) => {
      let interim = "";
      let finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      const combined = baseline ? `${baseline} ${finalText || interim}`.trim() : (finalText || interim);
      setInput(combined);
      if (finalText) baseline = combined;
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    try {
      cancelSpeech();
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const finalizeSession = async () => {
    if (finalizing) return;
    setFinalizing(true);
    cancelSpeech();
    router.push(`/r/${sessionId}`);
  };

  if (!sess) {
    return <div className="min-h-screen flex items-center justify-center text-bone-500 font-mono">세션 로드 중...</div>;
  }

  const profilerTurns = verdictHint?.turns ?? messages.filter((m) => m.role === "profiler").length;
  const confidence = verdictHint?.confidence ?? 0;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-ink-500 bg-ink-900/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-[11px] text-blood-500 shrink-0">●  REC</span>
              <span className="font-mono text-xs text-bone-200 tracking-widest truncate">
                심문실 #07 · <span className="text-bone-100">{sess.suspect_name}</span>{" "}
                <span className="text-bone-500">({sess.relation})</span>
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => getBgm().toggleMute()}
                title={bgm.muted ? "BGM 켜기" : "BGM 끄기"}
                className={`px-2.5 py-1 border text-[10px] font-mono tracking-widest transition-colors ${
                  bgm.muted ? "border-ink-500 text-bone-500 hover:border-bone-300" : "border-blood-500 text-blood-300 bg-blood-900/20"
                }`}
              >
                {bgm.muted ? "♪ OFF" : "♪ ON"}
              </button>
              {isSpeechSupported() && (
                <button
                  onClick={toggleVoice}
                  title={voiceOn ? "음성 끄기" : "음성 켜기"}
                  className={`px-3 py-1 border text-[10px] font-mono tracking-widest transition-colors ${
                    voiceOn ? "border-blood-500 text-blood-300 bg-blood-900/30" : "border-ink-500 text-bone-500 hover:border-bone-300"
                  }`}
                >
                  {voiceOn ? "🔊 ON" : "🔇 OFF"}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-bone-500 tracking-widest shrink-0">
              {verdictHint?.canFinalize ? "분석 준비 완료" : `진행 ${profilerTurns}턴 · 신뢰도 ${confidence}%`}
            </span>
            <div className="flex-1 h-[3px] bg-ink-700 overflow-hidden">
              <div
                className="h-full bg-blood-500 transition-all duration-700"
                style={{ width: `${confidence}%`, boxShadow: "0 0 8px rgba(184,0,0,0.6)" }}
              />
            </div>
            <button
              onClick={finalizeSession}
              disabled={!verdictHint?.canFinalize || finalizing}
              className={`shrink-0 text-[11px] font-mono tracking-widest px-3 py-1 transition-all uppercase ${
                verdictHint?.canFinalize && !finalizing
                  ? "text-blood-300 hover:text-bone-100 hover:bg-blood-900 border border-blood-500 animate-pulse"
                  : "text-bone-500 border border-ink-500 cursor-not-allowed"
              }`}
            >
              {finalizing ? "분석 중..." : verdictHint?.canFinalize ? "▶ 보고서 생성" : "분석 잠금"}
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-ink-500 bg-ink-800/40">
        <div className="max-w-4xl mx-auto px-6 py-2.5 text-xs text-bone-300 flex items-baseline gap-3">
          <span className="font-mono text-[10px] text-blood-300 tracking-widest uppercase shrink-0">정황</span>
          <span className="italic line-clamp-2">{sess.situation}</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {messages.map((m, i) => (
            <Bubble
              key={i}
              role={m.role}
              content={m.content}
              showChoices={i === messages.length - 1 && !streaming}
              onPickChoice={(choice) => {
                if (streaming) return;
                cancelSpeech();
                setMessages((prev) => [...prev, { role: "suspect", content: choice }]);
                sendToProfiler(choice);
              }}
            />
          ))}
          {streaming && streamBuf && <Bubble role="profiler" content={streamBuf} streaming />}
          {streaming && !streamBuf && (
            <div className="flex items-center gap-3 text-bone-300 text-sm">
              <span className="font-mono text-[10px] tracking-widest text-blood-300">분석 중</span>
              <span className="dot-typing"><span></span><span></span><span></span></span>
            </div>
          )}
          {verdictHint?.canFinalize && (
            <div className="border-2 border-blood-500 bg-blood-900/20 p-4 text-center">
              <div className="font-mono text-[10px] tracking-widest text-blood-300 mb-1">⚠ AUTO-FINALIZATION TRIGGERED</div>
              <div className="text-bone-100 text-sm">충분한 진술 확보 — 보고서 생성으로 자동 전환됩니다</div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-ink-500 bg-ink-900/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex gap-2 items-stretch">
            {isRecognitionSupported() && (
              <button
                onClick={toggleMic}
                disabled={streaming}
                title={listening ? "녹음 중지" : "음성으로 답변"}
                className={`shrink-0 w-12 border-2 transition-all flex items-center justify-center ${
                  listening
                    ? "border-blood-500 bg-blood-900/40 text-blood-300 mic-pulse"
                    : "border-ink-500 text-bone-300 hover:border-bone-300 disabled:opacity-30"
                }`}
              >
                <span className="text-xl leading-none">🎤</span>
              </button>
            )}

            <div className="flex-1 border border-ink-500 focus-within:border-blood-500 transition-colors bg-ink-800">
              <div className="px-3 pt-1.5 pb-1 font-mono text-[10px] text-bone-500 tracking-widest border-b border-ink-500/60 flex justify-between">
                <span>당신 ({sess.suspect_name} 입장에서 답변)</span>
                {listening && <span className="text-blood-300 animate-pulse">● 녹음 중</span>}
              </div>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={streaming}
                placeholder={
                  streaming ? "프로파일러가 분석 중..." :
                  listening ? "말씀하세요..." :
                  "솔직하게 답변하세요. 거짓은 모순으로 드러납니다..."
                }
                rows={2}
                className="w-full bg-transparent px-3 py-2 text-bone-100 placeholder-bone-500 resize-none disabled:opacity-50"
              />
            </div>

            <button
              onClick={onSubmit}
              disabled={!input.trim() || streaming}
              className="shrink-0 px-6 border-2 border-blood-500 text-blood-300 font-mono text-xs tracking-widest hover:bg-blood-900 hover:text-bone-100 disabled:border-ink-500 disabled:text-bone-500 disabled:hover:bg-transparent transition-colors uppercase"
            >
              ▶<br />전송
            </button>
          </div>
          <p className="mt-2.5 text-[10px] font-mono text-bone-500 tracking-widest text-center">
            [ENTER] 전송 · [SHIFT+ENTER] 줄바꿈
            {isRecognitionSupported() && " · 🎤 음성 입력"}
            {isSpeechSupported() && " · 🔊 음성 출력"}
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Detect a `[선택]` marker in profiler text and return question + choices.
 * Format the profiler emits:
 *   ...question text...
 *
 *   [선택]
 *   - 옵션 A
 *   - 옵션 B
 *   - 직접 입력
 */
function parseChoices(text: string): { question: string; choices: string[] } | null {
  // Match [선택] (or [선택지]) marker followed by lines starting with "-"
  const m = text.match(/^([\s\S]*?)\n+\[\s*선택지?\s*\]\s*\n([\s\S]*)$/);
  if (!m) return null;
  const question = m[1].trim();
  const block = m[2];
  const choices: string[] = [];
  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const itemMatch = line.match(/^[-•*]\s*(.+)$/);
    if (!itemMatch) {
      // Non-bullet line after the list — stop parsing
      if (choices.length) break;
      continue;
    }
    choices.push(itemMatch[1].trim());
  }
  if (choices.length < 2) return null;
  return { question, choices };
}

function Bubble({
  role,
  content,
  streaming,
  showChoices,
  onPickChoice,
}: {
  role: "profiler" | "suspect";
  content: string;
  streaming?: boolean;
  showChoices?: boolean;
  onPickChoice?: (choice: string) => void;
}) {
  if (role === "profiler") {
    const parsed = !streaming && showChoices ? parseChoices(content) : null;
    return (
      <div className="space-y-1">
        <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] uppercase">
          ▌ 프로파일러 — 표창원
        </div>
        <div
          className={`border-l-2 border-blood-500 pl-4 py-2 text-bone-100 leading-loose font-serif text-[15px] ${
            streaming ? "text-flicker" : ""
          }`}
        >
          {parsed ? parsed.question : content}
          {streaming && <span className="terminal-cursor" />}
        </div>
        {parsed && onPickChoice && (
          <div className="ml-4 mt-2 flex flex-wrap gap-2">
            {parsed.choices.map((c, i) => {
              const isFreeform = /직접\s*입력|기타/.test(c);
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (isFreeform) {
                      // Just focus the textarea; let user type
                      document
                        .querySelector<HTMLTextAreaElement>("textarea")
                        ?.focus();
                      return;
                    }
                    onPickChoice(c);
                  }}
                  className={`text-sm px-4 py-2 border transition-colors ${
                    isFreeform
                      ? "border-ink-500 text-bone-300 hover:border-bone-300 italic"
                      : "border-blood-700 text-bone-100 hover:border-blood-500 hover:bg-blood-900/30"
                  }`}
                >
                  {isFreeform ? "✎ " : ""}{c}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1 ml-12">
      <div className="font-mono text-[10px] text-bone-300 tracking-[0.3em] uppercase text-right">
        진술자 ▐
      </div>
      <div className="border-r-2 border-ink-500 pr-4 py-2 text-bone-300 text-right leading-relaxed text-[14px]">
        {content}
      </div>
    </div>
  );
}
