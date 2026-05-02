"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Verdict = "TRUTHFUL" | "PARTIAL" | "EVASIVE" | "DECEPTIVE";
type Report = {
  case_no: string;
  credibility: number;
  consistency: number;
  evasion: number;
  emotional_baseline: string;
  verdict: Verdict;
  one_line: string;
  red_flags: { quote: string; analysis: string }[];
  consistencies: { quote: string; analysis: string }[];
  recommendation: string;
};

const VERDICT_INFO: Record<
  Verdict,
  { ko: string; color: string; subtitle: string }
> = {
  TRUTHFUL: {
    ko: "신뢰 가능",
    color: "text-emerald-400 border-emerald-400",
    subtitle: "진술 내 모순 없음",
  },
  PARTIAL: {
    ko: "부분적 진실",
    color: "text-amber-400 border-amber-400",
    subtitle: "사실과 누락이 혼재",
  },
  EVASIVE: {
    ko: "회피·은폐 정황",
    color: "text-orange-400 border-orange-400",
    subtitle: "핵심 회피 패턴 다수",
  },
  DECEPTIVE: {
    ko: "기만 정황 강함",
    color: "text-blood-300 border-blood-500",
    subtitle: "거짓 진술 가능성 높음",
  },
};

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const transcript = sessionStorage.getItem("girigo:transcript");
    if (!transcript) {
      router.push("/setup");
      return;
    }

    const phases = [
      "녹취록 인덱싱 중",
      "음성 패턴 분석 중",
      "모순 교차 검토 중",
      "감정 기저선 추정 중",
      "최종 판정 작성 중",
    ];
    const phaseId = setInterval(() => {
      setPhase((p) => Math.min(p + 1, phases.length - 1));
    }, 1400);

    (async () => {
      try {
        const { caseInfo, messages } = JSON.parse(transcript);
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseInfo, messages }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "보고서 생성 실패");
        }
        const r = (await res.json()) as Report;
        setReport(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "분석 중 오류 발생");
      } finally {
        clearInterval(phaseId);
        setLoading(false);
      }
    })();

    return () => clearInterval(phaseId);
  }, [router]);

  if (loading) return <LoadingScreen phase={phase} />;
  if (error) return <ErrorScreen error={error} />;
  if (!report) return null;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-3xl mx-auto">
        {/* Document header */}
        <header className="border-b-2 border-bone-300 pb-4 mb-8">
          <div className="flex justify-between items-start text-[10px] font-mono text-bone-300 mb-3 tracking-widest">
            <span>CONFIDENTIAL · 機密</span>
            <span>기리고 행동분석센터</span>
          </div>
          <h1 className="font-serif text-4xl text-bone-100 mb-1">
            진술 신빙성 분석 보고서
          </h1>
          <p className="font-mono text-xs text-bone-300 tracking-widest">
            STATEMENT CREDIBILITY ASSESSMENT — CASE NO. {report.case_no}
          </p>
          <p className="font-mono text-[10px] text-bone-500 mt-2">
            발급일: {new Date().toLocaleString("ko-KR")} · 검토 프로파일러: 김재현
          </p>
        </header>

        {/* Verdict banner */}
        <Verdict verdict={report.verdict} oneLine={report.one_line} />

        {/* Score grid */}
        <section className="mt-8 grid grid-cols-3 gap-3">
          <ScoreCard label="진술 신빙성" value={report.credibility} invert />
          <ScoreCard label="내부 일관성" value={report.consistency} invert />
          <ScoreCard label="회피 지수" value={report.evasion} />
        </section>

        {/* Emotional baseline */}
        <section className="mt-8 border border-ink-500 px-5 py-4">
          <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-2 uppercase">
            감정 기저선 (Emotional Baseline)
          </div>
          <p className="text-bone-100 font-serif italic">
            “{report.emotional_baseline}”
          </p>
        </section>

        {/* Red flags */}
        {report.red_flags.length > 0 && (
          <section className="mt-8">
            <SectionTitle no="01" title="의심 발언 (Red Flags)" />
            <div className="space-y-4">
              {report.red_flags.map((f, i) => (
                <FlagCard key={i} {...f} type="red" />
              ))}
            </div>
          </section>
        )}

        {/* Consistencies */}
        {report.consistencies.length > 0 && (
          <section className="mt-8">
            <SectionTitle no="02" title="신뢰 가능 발언" />
            <div className="space-y-4">
              {report.consistencies.map((c, i) => (
                <FlagCard key={i} {...c} type="green" />
              ))}
            </div>
          </section>
        )}

        {/* Recommendation */}
        <section className="mt-8 border-2 border-blood-700 bg-blood-900/10 p-6">
          <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-3 uppercase">
            03 · 의뢰인 권고사항
          </div>
          <p className="text-bone-100 leading-loose font-serif text-[15px]">
            {report.recommendation}
          </p>
        </section>

        {/* Footer */}
        <footer className="mt-12 border-t border-ink-500 pt-6 text-center">
          <p className="font-serif italic text-bone-300 text-sm mb-6">
            “진술이 끝나는 곳에서, 진실은 시작됩니다.”
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/setup"
              className="px-6 py-3 border border-blood-500 text-blood-300 font-mono text-xs tracking-widest hover:bg-blood-900 hover:text-bone-100 transition-colors uppercase"
            >
              새 사건 의뢰
            </Link>
            <Link
              href="/"
              className="px-6 py-3 border border-ink-500 text-bone-300 font-mono text-xs tracking-widest hover:border-bone-300 transition-colors uppercase"
            >
              종료
            </Link>
          </div>
          <p className="mt-8 text-[10px] font-mono text-bone-500 leading-relaxed">
            본 보고서는 행동분석 AI에 의해 생성되었으며, 참고용으로만 활용하십시오.
            <br />
            법적 효력 없음 · 이 분석은 절대적 진실을 보장하지 않습니다.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Verdict({ verdict, oneLine }: { verdict: Verdict; oneLine: string }) {
  const info = VERDICT_INFO[verdict];
  return (
    <section className={`border-2 ${info.color} p-6 vignette`}>
      <div className="text-center">
        <div className="font-mono text-[10px] tracking-[0.4em] text-bone-300 uppercase mb-3">
          ▌ 최종 판정 ▐
        </div>
        <div className={`font-serif text-5xl font-black mb-1 ${info.color.split(" ")[0]} text-glow`}>
          {info.ko}
        </div>
        <div className="font-mono text-xs tracking-widest text-bone-300 mb-4">
          {verdict} · {info.subtitle}
        </div>
        <div className="border-t border-ink-500 pt-4 mt-4">
          <p className="font-serif italic text-bone-100 text-lg leading-relaxed">
            “{oneLine}”
          </p>
        </div>
      </div>
    </section>
  );
}

function ScoreCard({
  label,
  value,
  invert,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  // For "credibility" and "consistency", high = good. For "evasion", high = bad.
  const isGood = invert ? value >= 60 : value < 40;
  const isBad = invert ? value < 40 : value >= 60;
  const color = isBad
    ? "text-blood-300 border-blood-500"
    : isGood
    ? "text-emerald-400 border-emerald-400"
    : "text-amber-400 border-amber-400";

  return (
    <div className={`border ${color} p-4 text-center`}>
      <div className="font-mono text-[10px] text-bone-300 tracking-widest mb-2 uppercase">
        {label}
      </div>
      <div className={`font-mono text-4xl font-black ${color.split(" ")[0]}`}>
        {value}
      </div>
      <div className="font-mono text-[9px] text-bone-500 mt-1">/ 100</div>
      <div className="mt-2 h-1 bg-ink-700">
        <div
          className={`h-full ${color.split(" ")[0].replace("text-", "bg-")}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ no, title }: { no: string; title: string }) {
  return (
    <h3 className="font-mono text-[11px] text-blood-300 tracking-[0.3em] mb-3 uppercase border-b border-ink-500 pb-2">
      {no} · {title}
    </h3>
  );
}

function FlagCard({
  quote,
  analysis,
  type,
}: {
  quote: string;
  analysis: string;
  type: "red" | "green";
}) {
  const border = type === "red" ? "border-l-blood-500" : "border-l-emerald-500";
  return (
    <div className={`border-l-2 ${border} pl-4 py-2 bg-ink-800/50`}>
      <p className="font-serif italic text-bone-100 mb-2 leading-relaxed">
        “{quote}”
      </p>
      <p className="text-bone-300 text-sm leading-relaxed">→ {analysis}</p>
    </div>
  );
}

function LoadingScreen({ phase }: { phase: number }) {
  const phases = [
    "녹취록 인덱싱 중",
    "음성 패턴 분석 중",
    "모순 교차 검토 중",
    "감정 기저선 추정 중",
    "최종 판정 작성 중",
  ];
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="font-mono text-[10px] text-blood-300 tracking-[0.4em] mb-6 uppercase text-flicker">
          ▌ ANALYSIS IN PROGRESS ▐
        </div>
        <div className="font-serif text-2xl text-bone-100 mb-8">
          분석 결과를 처리하고 있습니다
        </div>
        <div className="space-y-2 text-left">
          {phases.map((p, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 font-mono text-sm transition-opacity ${
                i <= phase ? "opacity-100" : "opacity-30"
              }`}
            >
              <span
                className={
                  i < phase
                    ? "text-emerald-400"
                    : i === phase
                    ? "text-blood-300 text-flicker"
                    : "text-bone-500"
                }
              >
                {i < phase ? "✓" : i === phase ? "▶" : "○"}
              </span>
              <span
                className={
                  i < phase
                    ? "text-bone-300"
                    : i === phase
                    ? "text-bone-100"
                    : "text-bone-500"
                }
              >
                {p}
                {i === phase && (
                  <span className="dot-typing ml-2">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-12 text-[10px] font-mono text-bone-500 tracking-widest">
          분석에는 최대 30초가 소요될 수 있습니다.
        </p>
      </div>
    </main>
  );
}

function ErrorScreen({ error }: { error: string }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md border border-blood-500 p-8">
        <div className="font-mono text-blood-300 text-[10px] tracking-widest mb-4">
          ⚠ SYSTEM ERROR
        </div>
        <h2 className="font-serif text-2xl text-bone-100 mb-4">분석에 실패했습니다</h2>
        <p className="text-bone-300 text-sm mb-6 font-mono">{error}</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 border border-blood-500 text-blood-300 font-mono text-xs tracking-widest hover:bg-blood-900"
        >
          처음으로
        </Link>
      </div>
    </main>
  );
}
