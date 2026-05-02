"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import IntroSequence from "@/components/IntroSequence";

export default function Home() {
  const [time, setTime] = useState("");
  const [caseNo, setCaseNo] = useState("");
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  // Decide whether to show the intro (skip if already seen this session)
  useEffect(() => {
    setShowIntro(sessionStorage.getItem("girigo:introSeen") !== "1");
  }, []);

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setTime(
        `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(
          d.getHours()
        )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      );
    };
    update();
    const id = setInterval(update, 1000);
    setCaseNo(
      `K-${Math.floor(10000 + Math.random() * 90000)}-${String.fromCharCode(
        65 + Math.floor(Math.random() * 26)
      )}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`
    );
    return () => clearInterval(id);
  }, []);

  // Defer rendering until we know intro state (avoids flash of homepage)
  if (showIntro === null) {
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {showIntro && <IntroSequence onDone={() => setShowIntro(false)} />}

      {/* Top status bar */}
      <div className="fixed top-0 left-0 right-0 px-6 py-3 flex justify-between text-[11px] font-mono text-bone-300 border-b border-ink-600 bg-ink-900/80 backdrop-blur z-20">
        <span>● REC &nbsp; CH.07 &nbsp; ENCRYPTED</span>
        <span className="text-flicker">{time}</span>
        <span>CASE NO. {caseNo}</span>
      </div>

      <div className="max-w-xl w-full text-center mt-16">
        {/* Title */}
        <h1 className="font-serif text-7xl md:text-8xl font-black tracking-tighter mb-3 text-bone-100 text-glow">
          기<span className="text-blood-500">·</span>리<span className="text-blood-500">·</span>고
        </h1>
        <p className="font-mono text-[11px] tracking-[0.6em] text-bone-300 mb-8 uppercase">
          진실 분석 프로토콜
        </p>

        {/* Tagline */}
        <p className="font-serif text-bone-100 text-xl mb-3 italic leading-snug">
          그 사람이 정말 진실을 말하고 있을까?
        </p>
        <p className="text-bone-300 text-sm mb-12">
          3분 안에, AI 프로파일러가 심문해서 알려드립니다.
        </p>

        {/* 3-step explainer — clearer than prose */}
        <div className="grid grid-cols-3 gap-2 mb-12">
          <Step n="01" title="정황 입력" desc="누구의 어떤 일인지" />
          <Step n="02" title="심문 진행" desc="AI가 5턴 이상 추궁" />
          <Step n="03" title="보고서 발급" desc="신빙성 점수 + 분석" />
        </div>

        {/* CTA */}
        <Link
          href="/setup"
          className="inline-block group relative px-14 py-5 border-2 border-blood-500 text-blood-300 font-mono text-sm tracking-[0.4em] uppercase hover:bg-blood-900 hover:text-bone-100 transition-colors duration-200 glitch-on-hover"
        >
          <span className="relative z-10">▶ 심문 시작</span>
          <span className="absolute inset-0 bg-blood-500/0 group-hover:bg-blood-500/10 transition" />
        </Link>

        {/* Disclaimer footer */}
        <p className="mt-16 text-[10px] font-mono text-bone-500 leading-relaxed tracking-wider">
          본 시스템은 행동 분석 AI(Claude)에 의해 운영되며, 결과는 참고용입니다.
          <br />
          입력하신 정보는 외부에 저장되지 않습니다.
        </p>
        <p className="mt-4 text-bone-300 text-[11px] italic font-serif">
          — 진술이 끝나는 곳에서, 진실은 시작됩니다 —
        </p>
      </div>
    </main>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="border border-ink-500 bg-ink-800/40 p-3 text-left">
      <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-1.5">
        {n}
      </div>
      <div className="text-bone-100 text-sm font-medium mb-0.5">{title}</div>
      <div className="text-bone-500 text-[11px] leading-snug">{desc}</div>
    </div>
  );
}
