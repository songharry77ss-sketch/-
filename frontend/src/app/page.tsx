"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import IntroSequence from "@/components/IntroSequence";
import { getBgm } from "@/lib/bgm";

export default function Landing() {
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    setShowIntro(sessionStorage.getItem("girigo:introSeen") !== "1");
  }, []);

  const onIntroDone = () => {
    setShowIntro(false);
    // Click already satisfied autoplay policy → start ambient BGM immediately
    getBgm().start();
  };

  if (showIntro === null) return <div className="min-h-screen bg-black" />;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {showIntro && <IntroSequence onDone={onIntroDone} />}

      {/* Background portrait — drop your image at /public/profiler-bg.jpg */}
      <div
        aria-hidden
        className="profiler-bg pointer-events-none absolute inset-0 z-0"
      />
      {/* Vignette + scrim so text stays readable on top of any image */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.85) 60%, rgba(10,10,10,0.97) 100%)",
        }}
      />

      {/* Top status bar */}
      <div className="fixed top-0 left-0 right-0 px-6 py-3 flex justify-between text-[11px] font-mono text-bone-300 border-b border-ink-600 bg-ink-900/80 backdrop-blur z-20">
        <span>
          <span className="text-blood-500">●</span> REC &nbsp; CH.07 &nbsp; ENCRYPTED
        </span>
        <span className="text-flicker">표창원 심문실</span>
        <span>지리고</span>
      </div>

      {/* Main content — z-10 above the background */}
      <div className="relative z-10 max-w-xl w-full text-center mt-16">
        <h1 className="font-serif text-7xl md:text-8xl font-black tracking-tighter mb-3 text-bone-100 text-glow">
          지<span className="text-blood-500">·</span>리<span className="text-blood-500">·</span>고
        </h1>
        <p className="font-mono text-[11px] tracking-[0.6em] text-bone-300 mb-8 uppercase">
          진실 분석 프로토콜
        </p>

        <p className="font-serif text-bone-100 text-xl mb-3 italic leading-snug">
          그 사람이 정말 진실을 말하고 있을까?
        </p>
        <p className="text-bone-300 text-sm mb-12">
          표창원 프로파일러가 직접 심문합니다.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-12">
          <Step n="01" title="정황 입력" desc="누구의 어떤 일인지" />
          <Step n="02" title="심문 진행" desc="모순을 끝까지 추궁" />
          <Step n="03" title="보고서 발급" desc="신뢰도 + 핵심 인용" />
        </div>

        <Link
          href="/setup"
          className="inline-block group relative px-14 py-5 border-2 border-blood-500 text-blood-300 font-mono text-sm tracking-[0.4em] uppercase hover:bg-blood-900 hover:text-bone-100 transition-colors duration-200 glitch-on-hover"
          onClick={() => {
            // Ensure BGM started (safe to call again — singleton no-op if running)
            getBgm().start();
          }}
        >
          <span className="relative z-10">▶ 심문 시작</span>
        </Link>

        <p className="mt-12 text-bone-300 text-[12px] italic font-serif leading-relaxed">
          "사람의 입은 진실을 말할 수 있고,
          <br />또 진실을 가릴 수도 있다.
          <br />그러나 그 둘은 결코 같은 모양이 아니다."
        </p>
        <p className="mt-2 font-mono text-[10px] text-bone-500 tracking-widest">— 표창원</p>

        <p className="mt-12 text-[10px] font-mono text-bone-500 leading-relaxed tracking-wider">
          본 프로토콜은 참고용이며, 어떠한 법적 효력도 가지지 않습니다.
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
    <div className="border border-ink-500 bg-ink-800/40 backdrop-blur-sm p-3 text-left">
      <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-1.5">{n}</div>
      <div className="text-bone-100 text-sm font-medium mb-0.5">{title}</div>
      <div className="text-bone-500 text-[11px] leading-snug">{desc}</div>
    </div>
  );
}
