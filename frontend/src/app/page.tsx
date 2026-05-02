"use client";

import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Top status bar */}
      <div className="fixed top-0 left-0 right-0 px-6 py-3 flex justify-between text-[11px] font-mono text-bone-300 border-b border-ink-600 bg-ink-900/80 backdrop-blur z-20">
        <span><span className="text-blood-500">●</span> REC &nbsp; CH.07 &nbsp; ENCRYPTED</span>
        <span className="text-flicker">RAG · 200 PAPERS</span>
        <span>v2.0 — TRUTH PROTOCOL</span>
      </div>

      <div className="max-w-xl w-full text-center mt-16">
        <h1 className="font-serif text-7xl md:text-8xl font-black tracking-tighter mb-3 text-bone-100 text-glow">
          지<span className="text-blood-500">·</span>리<span className="text-blood-500">·</span>고
        </h1>
        <p className="font-mono text-[11px] tracking-[0.6em] text-bone-300 mb-8 uppercase">
          진실 분석 프로토콜 v2
        </p>

        <p className="font-serif text-bone-100 text-xl mb-3 italic leading-snug">
          그 사람이 정말 진실을 말하고 있을까?
        </p>
        <p className="text-bone-300 text-sm mb-12">
          행동 분석 논문 200건 + Claude Opus 4.7로 심문 + 분석합니다.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-12">
          <Step n="01" title="정황 입력" desc="누구의 어떤 일인지" />
          <Step n="02" title="AI 심문" desc="실제 기법으로 추궁" />
          <Step n="03" title="자동 보고서" desc="신빙성 + 학술 인용" />
        </div>

        <Link
          href="/setup"
          className="inline-block group relative px-14 py-5 border-2 border-blood-500 text-blood-300 font-mono text-sm tracking-[0.4em] uppercase hover:bg-blood-900 hover:text-bone-100 transition-colors duration-200 glitch-on-hover"
        >
          <span className="relative z-10">▶ 심문 시작</span>
        </Link>

        <div className="mt-12 grid grid-cols-2 gap-3 text-[10px] font-mono text-bone-500 leading-relaxed">
          <div className="border border-ink-500 p-3 text-left">
            <div className="text-blood-300 mb-1 tracking-widest">RAG 기반</div>
            <div>Reid · CBCA · SCAN · Reality Monitoring · Cognitive Interview · Verifiability Approach</div>
          </div>
          <div className="border border-ink-500 p-3 text-left">
            <div className="text-blood-300 mb-1 tracking-widest">자동 종료</div>
            <div>AI가 진실/거짓 판별이 충분하다고 판단하면 심문을 자동으로 마칩니다</div>
          </div>
        </div>

        <p className="mt-12 text-[10px] font-mono text-bone-500 leading-relaxed tracking-wider">
          본 시스템은 행동 분석 AI(Claude Opus 4.7)에 의해 운영되며, 결과는 참고용입니다.
        </p>
        <p className="mt-3 text-bone-300 text-[11px] italic font-serif">
          — 진술이 끝나는 곳에서, 진실은 시작됩니다 —
        </p>
      </div>
    </main>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="border border-ink-500 bg-ink-800/40 p-3 text-left">
      <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-1.5">{n}</div>
      <div className="text-bone-100 text-sm font-medium mb-0.5">{title}</div>
      <div className="text-bone-500 text-[11px] leading-snug">{desc}</div>
    </div>
  );
}
