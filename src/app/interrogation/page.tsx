"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  cancelSpeech,
  createRecognizer,
  isRecognitionSupported,
  isSpeechSupported,
  speakKorean,
} from "@/lib/speech";

type Msg = { role: "profiler" | "suspect"; content: string };
type CaseInfo = {
  suspectName: string;
  relation: string;
  situation: string;
  startedAt: string;
};

const MIN_TURNS = 5;

export default function InterrogationPage() {
  const router = useRouter();
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuf, setStreamBuf] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<ReturnType<typeof createRecognizer> | null>(null);

  // Load case info
  useEffect(() => {
    const raw = sessionStorage.getItem("girigo:case");
    if (!raw) {
      router.push("/setup");
      return;
    }
    setCaseInfo(JSON.parse(raw));
  }, [router]);

  // Kick off first profiler message
  useEffect(() => {
    if (!caseInfo || messages.length > 0) return;
    sendToProfiler([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseInfo]);

  // Elapsed timer
  useEffect(() => {
    if (!caseInfo) return;
    const start = new Date(caseInfo.startedAt).getTime();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [caseInfo]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamBuf]);

  // Cleanup TTS / STT on unmount
  useEffect(() => {
    return () => {
      cancelSpeech();
      try {
        recRef.current?.abort();
      } catch {}
    };
  }, []);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  async function sendToProfiler(history: Msg[]) {
    if (!caseInfo) return;
    setStreaming(true);
    setStreamBuf("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseInfo, history }),
      });

      if (!res.ok || !res.body) throw new Error("연결 실패");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamBuf(acc);
      }
      setMessages((m) => [...m, { role: "profiler", content: acc }]);
      setStreamBuf("");

      // Speak the message if voice is enabled
      if (voiceOn && acc) {
        speakKorean(acc, { rate: 0.85, pitch: 0.7 });
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "profiler", content: "[연결 오류 — 잠시 후 다시 시도하세요]" },
      ]);
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }

  const onSubmit = () => {
    if (!input.trim() || streaming) return;
    if (listening) toggleMic();
    cancelSpeech();
    const next: Msg[] = [...messages, { role: "suspect", content: input.trim() }];
    setMessages(next);
    setInput("");
    sendToProfiler(next);
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
      try {
        recRef.current?.stop();
      } catch {}
      setListening(false);
      return;
    }
    const r = createRecognizer();
    if (!r) {
      alert("이 브라우저는 음성 입력을 지원하지 않습니다. (Chrome/Edge 권장)");
      return;
    }
    recRef.current = r;
    let interim = "";
    let baseline = input;
    r.onresult = (e: any) => {
      interim = "";
      let finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      const combined = baseline
        ? `${baseline} ${finalText || interim}`.trim()
        : finalText || interim;
      setInput(combined);
      if (finalText) baseline = combined;
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    try {
      cancelSpeech(); // don't have TTS overlapping mic
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const profilerTurns = messages.filter((m) => m.role === "profiler").length;
  const progress = Math.min(100, (profilerTurns / MIN_TURNS) * 100);
  const canFinish = profilerTurns >= MIN_TURNS && !streaming;

  const finishInterrogation = () => {
    cancelSpeech();
    sessionStorage.setItem(
      "girigo:transcript",
      JSON.stringify({ caseInfo, messages })
    );
    router.push("/report");
  };

  if (!caseInfo) return null;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-ink-500 bg-ink-900/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-[11px] text-blood-500 shrink-0">●  REC</span>
              <span className="font-mono text-xs text-bone-200 tracking-widest truncate">
                심문실 #07 · <span className="text-bone-100">{caseInfo.suspectName}</span>{" "}
                <span className="text-bone-500">({caseInfo.relation})</span>
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-[11px] text-bone-300 text-flicker">
                {fmtTime(elapsed)}
              </span>
              {/* Voice toggle */}
              {isSpeechSupported() && (
                <button
                  onClick={toggleVoice}
                  title={voiceOn ? "프로파일러 음성 끄기" : "프로파일러 음성 켜기"}
                  className={`px-3 py-1 border text-[10px] font-mono tracking-widest transition-colors ${
                    voiceOn
                      ? "border-blood-500 text-blood-300 bg-blood-900/30"
                      : "border-ink-500 text-bone-500 hover:border-bone-300"
                  }`}
                >
                  {voiceOn ? "🔊 ON" : "🔇 OFF"}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar — visual stage indicator */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-bone-500 tracking-widest shrink-0">
              {profilerTurns >= MIN_TURNS ? "분석 가능" : `진행 ${profilerTurns}/${MIN_TURNS}`}
            </span>
            <div className="flex-1 h-[3px] bg-ink-700 overflow-hidden">
              <div
                className="h-full bg-blood-500 transition-all duration-500"
                style={{ width: `${progress}%`, boxShadow: "0 0 8px rgba(184,0,0,0.6)" }}
              />
            </div>
            <button
              onClick={finishInterrogation}
              disabled={!canFinish}
              className={`shrink-0 text-[11px] font-mono tracking-widest px-3 py-1 transition-all uppercase ${
                canFinish
                  ? "text-blood-300 hover:text-bone-100 hover:bg-blood-900 border border-blood-500"
                  : "text-bone-500 border border-ink-500 cursor-not-allowed"
              }`}
            >
              {canFinish ? "▶ 보고서 생성" : "분석 잠금"}
            </button>
          </div>
        </div>
      </header>

      {/* Case summary banner */}
      <div className="border-b border-ink-500 bg-ink-800/40">
        <div className="max-w-4xl mx-auto px-6 py-2.5 text-xs text-bone-300 flex items-baseline gap-3">
          <span className="font-mono text-[10px] text-blood-300 tracking-widest uppercase shrink-0">
            정황
          </span>
          <span className="italic line-clamp-2">{caseInfo.situation}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
          {streaming && streamBuf && (
            <MessageBubble role="profiler" content={streamBuf} streaming />
          )}
          {streaming && !streamBuf && (
            <div className="flex items-center gap-3 text-bone-300 text-sm">
              <span className="font-mono text-[10px] tracking-widest text-blood-300">
                프로파일러가 분석 중
              </span>
              <span className="dot-typing">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-ink-500 bg-ink-900/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex gap-2 items-stretch">
            {/* Mic button */}
            {isRecognitionSupported() && (
              <button
                onClick={toggleMic}
                disabled={streaming}
                title={listening ? "녹음 중 — 클릭하여 중지" : "음성으로 답변"}
                className={`shrink-0 w-12 border-2 transition-all flex items-center justify-center ${
                  listening
                    ? "border-blood-500 bg-blood-900/40 text-blood-300 mic-pulse"
                    : "border-ink-500 text-bone-300 hover:border-bone-300 disabled:opacity-30"
                }`}
              >
                <span className="text-xl leading-none">🎤</span>
              </button>
            )}

            {/* Input area */}
            <div className="flex-1 border border-ink-500 focus-within:border-blood-500 transition-colors bg-ink-800">
              <div className="px-3 pt-1.5 pb-1 font-mono text-[10px] text-bone-500 tracking-widest border-b border-ink-500/60 flex justify-between">
                <span>당신 ({caseInfo.suspectName} 입장에서 답변)</span>
                {listening && <span className="text-blood-300 animate-pulse">● 녹음 중</span>}
              </div>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                disabled={streaming}
                placeholder={
                  streaming
                    ? "프로파일러가 말하고 있습니다..."
                    : listening
                    ? "말씀하세요..."
                    : "솔직하게 답변하세요. 거짓은 모순으로 드러납니다..."
                }
                rows={2}
                className="w-full bg-transparent px-3 py-2 text-bone-100 placeholder-bone-500 resize-none disabled:opacity-50"
              />
            </div>

            {/* Send button */}
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

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: "profiler" | "suspect";
  content: string;
  streaming?: boolean;
}) {
  if (role === "profiler") {
    return (
      <div className="space-y-1">
        <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] uppercase">
          ▌ 프로파일러 — 김재현
        </div>
        <div
          className={`border-l-2 border-blood-500 pl-4 py-2 text-bone-100 leading-loose font-serif text-[15px] ${
            streaming ? "text-flicker" : ""
          }`}
        >
          {content}
          {streaming && <span className="terminal-cursor" />}
        </div>
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
