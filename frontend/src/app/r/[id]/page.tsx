"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, type Report, type Verdict } from "@/lib/api";

const VERDICT_INFO: Record<
  Verdict,
  {
    label: string;
    plain: string;
    icon: string;
    color: string;
    accent: string;
    bg: string;
  }
> = {
  TRUTHFUL: {
    label: "신뢰 가능",
    plain: "이 사람은 거짓말을 하고 있을 가능성이 낮습니다.",
    icon: "✓",
    color: "text-emerald-300",
    accent: "border-emerald-500",
    bg: "bg-emerald-900/15",
  },
  PARTIAL: {
    label: "부분적 진실",
    plain: "사실과 누락이 섞여 있습니다. 일부는 진실, 일부는 숨기고 있습니다.",
    icon: "◐",
    color: "text-amber-300",
    accent: "border-amber-500",
    bg: "bg-amber-900/15",
  },
  EVASIVE: {
    label: "회피·은폐 정황",
    plain: "직접적 거짓말은 아니지만, 핵심을 회피하며 무언가 감추고 있습니다.",
    icon: "△",
    color: "text-orange-300",
    accent: "border-orange-500",
    bg: "bg-orange-900/15",
  },
  DECEPTIVE: {
    label: "기만 정황 강함",
    plain: "거짓말을 하고 있을 가능성이 매우 높습니다.",
    icon: "✗",
    color: "text-blood-300",
    accent: "border-blood-500",
    bg: "bg-blood-900/20",
  },
};

// Translate academic technique names → plain Korean
const TECHNIQUE_PLAIN: Record<string, string> = {
  Reid: "표준 심문 기법 (FBI 활용)",
  "Reid Technique": "표준 심문 기법 (FBI 활용)",
  "Reid technique": "표준 심문 기법 (FBI 활용)",
  CBCA: "진술 내용 분석 (진짜 기억 vs 만들어낸 진술 구별)",
  SVA: "진술 신빙성 평가",
  "Statement Validity Assessment": "진술 신빙성 평가",
  "Reality Monitoring": "기억 검증법 (진짜 경험 vs 상상 구별)",
  SCAN: "어휘 분석 기법",
  "Cognitive Interview": "인지 면접법 (재구성 요청)",
  BAI: "행동 분석 면접법",
  "Behavioral Analysis Interview": "행동 분석 면접법",
  "Verifiability Approach": "검증 가능성 접근법",
  PEACE: "PEACE 면접 모델 (영국 표준)",
};

function plainTechnique(name: string): string {
  // Try exact match first, then fuzzy
  if (TECHNIQUE_PLAIN[name]) return TECHNIQUE_PLAIN[name];
  for (const k of Object.keys(TECHNIQUE_PLAIN)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return TECHNIQUE_PLAIN[k];
  }
  return name;
}

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const phases = [
      "녹취록 인덱싱",
      "진술 모순 검토",
      "회피 패턴 분석",
      "감정 기저선 추정",
      "최종 판정 작성",
    ];
    const phaseId = setInterval(
      () => setPhase((p) => Math.min(p + 1, phases.length - 1)),
      2200
    );

    api
      .generateReport(params.id)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : "분석 실패"))
      .finally(() => {
        clearInterval(phaseId);
        setLoading(false);
      });
    return () => clearInterval(phaseId);
  }, [params.id]);

  if (loading) return <Loading phase={phase} />;
  if (error) return <ErrorScreen error={error} />;
  if (!report) return null;

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 md:py-10">
      <div className="max-w-2xl mx-auto">
        {/* Document header */}
        <header className="border-b border-bone-300 pb-4 mb-6">
          <div className="flex justify-between text-[10px] font-mono text-bone-300 mb-3 tracking-widest">
            <span>분석 완료</span>
            <span>CASE NO. {report.case_no}</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-bone-100">
            진실 분석 보고서
          </h1>
          <p className="font-mono text-[11px] text-bone-500 mt-2">
            {new Date().toLocaleString("ko-KR")} · 검토 프로파일러 표창원
          </p>
        </header>

        {/* ── 1. 한 줄 결론 (가장 중요) ── */}
        <VerdictHero verdict={report.verdict} oneLine={report.one_line} />

        {/* ── 2. 신뢰도 게이지 (한눈에 이해) ── */}
        <TrustMeter
          credibility={report.credibility}
          consistency={report.consistency}
          evasion={report.evasion}
        />

        {/* ── 3. 그래서 어떻게 해야 하나 (행동 권고) ── */}
        <Recommendation text={report.recommendation} />

        {/* ── 4. 가장 의심스러운 발언 ── */}
        {report.red_flags?.length > 0 && (
          <RedFlagsSection flags={report.red_flags} />
        )}

        {/* ── 5. 신뢰 가능한 발언 ── */}
        {report.consistencies?.length > 0 && (
          <ConsistenciesSection items={report.consistencies} />
        )}

        {/* ── 6. 자세한 분석 (접기/펼치기) ── */}
        <details
          open={showDetails}
          onToggle={(e) => setShowDetails(e.currentTarget.open)}
          className="mt-8 border border-ink-500"
        >
          <summary className="cursor-pointer px-5 py-4 font-mono text-[11px] text-blood-300 tracking-[0.3em] uppercase hover:bg-ink-800/50 transition-colors flex items-center justify-between">
            <span>{showDetails ? "▼" : "▶"} 자세한 분석 (선택)</span>
            <span className="text-bone-500">전문가용</span>
          </summary>
          <div className="border-t border-ink-500 p-5 space-y-6">
            {/* Emotional baseline */}
            <div>
              <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-2 uppercase">
                감정 기저선
              </div>
              <p className="text-bone-100 font-serif italic">
                "{report.emotional_baseline}"
              </p>
            </div>

            {/* Techniques */}
            {report.techniques_applied?.length > 0 && (
              <div>
                <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-2 uppercase">
                  적용된 분석 기법
                </div>
                <ul className="space-y-1.5 text-sm text-bone-200">
                  {report.techniques_applied.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-blood-500">▸</span>
                      <span>
                        <span className="font-mono text-bone-100">{t}</span>
                        <span className="text-bone-300 text-xs ml-2">
                          → {plainTechnique(t)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Citations */}
            {report.citations?.length > 0 && (
              <div>
                <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-2 uppercase">
                  참고 학술 문헌 ({report.citations.length}건)
                </div>
                <ul className="space-y-1.5 text-xs text-bone-300">
                  {report.citations.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-bone-500 font-mono shrink-0">
                        [{i + 1}]
                      </span>
                      <span className="leading-snug">
                        <span className="italic font-serif text-bone-200">
                          {c.title}
                        </span>
                        <span className="text-bone-500 ml-1">
                          — {c.authors.slice(0, 3).join(", ")}
                          {c.authors.length > 3 ? " 외" : ""}
                          {c.year ? ` (${c.year})` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>

        {/* Footer */}
        <footer className="mt-12 border-t border-ink-500 pt-6 text-center">
          <p className="font-serif italic text-bone-300 text-sm mb-6">
            "진술이 끝나는 곳에서, 진실은 시작됩니다."
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/setup"
              className="px-6 py-3 border-2 border-blood-500 text-blood-300 font-mono text-xs tracking-widest hover:bg-blood-900 hover:text-bone-100 transition-colors uppercase"
            >
              ▶ 새 사건 의뢰
            </Link>
            <Link
              href="/"
              className="px-6 py-3 border border-ink-500 text-bone-300 font-mono text-xs tracking-widest hover:border-bone-300 transition-colors uppercase"
            >
              종료
            </Link>
          </div>
          <p className="mt-8 text-[10px] font-mono text-bone-500 leading-relaxed">
            본 보고서는 행동분석 AI(Claude Opus 4.7) + 학술 문헌 기반 RAG로 생성됨.
            <br />
            참고용 · 법적 효력 없음 · 절대적 진실을 보장하지 않습니다.
          </p>
        </footer>
      </div>
    </main>
  );
}

// ─── COMPONENTS ──────────────────────────────────────────────────

function VerdictHero({
  verdict,
  oneLine,
}: {
  verdict: Verdict;
  oneLine: string;
}) {
  const info = VERDICT_INFO[verdict];
  return (
    <section
      className={`border-2 ${info.accent} ${info.bg} p-6 md:p-8 mb-6 text-center`}
    >
      <div className={`text-7xl md:text-8xl ${info.color} mb-3 font-serif font-black leading-none`}>
        {info.icon}
      </div>
      <div className="font-mono text-[10px] tracking-[0.4em] text-bone-300 uppercase mb-2">
        ▌ 최종 판정 ▐
      </div>
      <h2
        className={`font-serif text-3xl md:text-4xl font-black mb-3 ${info.color} text-glow`}
      >
        {info.label}
      </h2>
      <p className="text-bone-100 text-base leading-relaxed mb-5">
        {info.plain}
      </p>
      <div className="border-t border-ink-500 pt-4 mt-4 max-w-md mx-auto">
        <p className="font-serif italic text-bone-100 text-base md:text-lg leading-relaxed">
          "{oneLine}"
        </p>
        <p className="font-mono text-[9px] text-bone-500 mt-2 tracking-widest">
          — 표창원 프로파일러 종합
        </p>
      </div>
    </section>
  );
}

function TrustMeter({
  credibility,
  consistency,
  evasion,
}: {
  credibility: number;
  consistency: number;
  evasion: number;
}) {
  // Combined trust score: weighted average. Higher = more trustworthy.
  const trust = Math.round(
    (credibility * 0.5 + consistency * 0.3 + (100 - evasion) * 0.2) | 0
  );

  const tier = useMemo(() => {
    if (trust >= 75)
      return {
        label: "이 사람의 진술, 대체로 신뢰할 수 있습니다",
        color: "text-emerald-300",
        ring: "stroke-emerald-400",
        plain: `100명 중 약 ${trust}명 정도의 신뢰도`,
      };
    if (trust >= 50)
      return {
        label: "반반입니다. 사실과 누락이 섞여 있어요",
        color: "text-amber-300",
        ring: "stroke-amber-400",
        plain: "일부는 사실, 일부는 숨기고 있는 듯합니다",
      };
    if (trust >= 30)
      return {
        label: "신뢰하기 어려운 진술입니다",
        color: "text-orange-300",
        ring: "stroke-orange-400",
        plain: "회피와 모순이 다수 — 외부 검증 필요",
      };
    return {
      label: "거짓말일 가능성이 높습니다",
      color: "text-blood-300",
      ring: "stroke-blood-500",
      plain: "주요 진술 대부분에 의심 정황 — 직접 대면 추천 X",
    };
  }, [trust]);

  // SVG circle gauge — 280° arc
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (280 / 360);
  const fill = (trust / 100) * arcLength;

  return (
    <section className="mb-6 grid md:grid-cols-[160px_1fr] gap-5 border border-ink-500 p-5 md:p-6 items-center bg-ink-800/30">
      {/* Circular gauge */}
      <div className="relative w-32 h-32 mx-auto">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-[140deg]">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            className={tier.ring}
            strokeWidth="10"
            strokeDasharray={`${fill} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1.5s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`font-mono text-4xl font-black ${tier.color}`}>
            {trust}
          </div>
          <div className="font-mono text-[9px] text-bone-500 tracking-widest">
            / 100
          </div>
        </div>
      </div>

      <div>
        <div className="font-mono text-[10px] text-blood-300 tracking-[0.3em] mb-2 uppercase">
          종합 신뢰도
        </div>
        <h3
          className={`font-serif text-lg md:text-xl font-medium mb-2 ${tier.color} leading-snug`}
        >
          {tier.label}
        </h3>
        <p className="text-bone-300 text-sm mb-4">{tier.plain}</p>

        {/* Mini bars */}
        <div className="space-y-2">
          <MiniBar
            label="진술의 일관성"
            value={consistency}
            invert
            help="앞뒤 말이 맞는 정도"
          />
          <MiniBar
            label="진술의 신빙성"
            value={credibility}
            invert
            help="구체성·디테일·사실성"
          />
          <MiniBar
            label="회피 정도"
            value={evasion}
            help="핵심을 피하는 빈도 (높을수록 의심)"
          />
        </div>
      </div>
    </section>
  );
}

function MiniBar({
  label,
  value,
  invert,
  help,
}: {
  label: string;
  value: number;
  invert?: boolean;
  help: string;
}) {
  const isGood = invert ? value >= 60 : value < 40;
  const isBad = invert ? value < 40 : value >= 60;
  const color = isBad
    ? "bg-blood-500"
    : isGood
    ? "bg-emerald-400"
    : "bg-amber-400";
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-1">
        <span className="text-bone-200">
          <span className="font-medium">{label}</span>
          <span className="text-bone-500 ml-2 text-[10px]">— {help}</span>
        </span>
        <span className="font-mono text-bone-300">{value}</span>
      </div>
      <div className="h-1.5 bg-ink-700">
        <div
          className={`h-full ${color}`}
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            transition: "width 1s ease-out",
          }}
        />
      </div>
    </div>
  );
}

function Recommendation({ text }: { text: string }) {
  return (
    <section className="mb-6 border-2 border-blood-700 bg-blood-900/15 p-5 md:p-6">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-2xl">💡</span>
        <h3 className="font-mono text-[11px] text-blood-300 tracking-[0.3em] uppercase">
          그래서 어떻게 해야 하나
        </h3>
      </div>
      <p className="text-bone-100 leading-loose font-serif text-[15px] md:text-base">
        {text}
      </p>
    </section>
  );
}

function RedFlagsSection({
  flags,
}: {
  flags: { quote: string; analysis: string }[];
}) {
  return (
    <section className="mb-6">
      <SectionHeader
        emoji="🚨"
        no="01"
        title="가장 의심스러운 발언"
        subtitle={`${flags.length}개 포착`}
      />
      <div className="space-y-3">
        {flags.map((f, i) => (
          <div
            key={i}
            className="border border-blood-700/60 bg-ink-800/40 overflow-hidden"
          >
            <div className="bg-blood-900/30 px-4 py-2 font-mono text-[10px] text-blood-300 tracking-widest border-b border-blood-700/60">
              ⚠ 의심 #{i + 1}
            </div>
            <div className="p-4">
              <blockquote className="font-serif italic text-bone-100 text-[15px] leading-relaxed mb-3 border-l-2 border-blood-500 pl-3">
                "{f.quote}"
              </blockquote>
              <p className="text-bone-300 text-sm leading-relaxed pl-4">
                <span className="text-blood-300 font-mono text-xs mr-2">→</span>
                {f.analysis}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConsistenciesSection({
  items,
}: {
  items: { quote: string; analysis: string }[];
}) {
  return (
    <section className="mb-6">
      <SectionHeader
        emoji="✓"
        no="02"
        title="신뢰 가능한 발언"
        subtitle={`${items.length}개 확인`}
      />
      <div className="space-y-3">
        {items.map((c, i) => (
          <div
            key={i}
            className="border border-emerald-600/40 bg-ink-800/40 overflow-hidden"
          >
            <div className="bg-emerald-900/20 px-4 py-2 font-mono text-[10px] text-emerald-300 tracking-widest border-b border-emerald-600/40">
              ✓ 신뢰 #{i + 1}
            </div>
            <div className="p-4">
              <blockquote className="font-serif italic text-bone-100 text-[15px] leading-relaxed mb-3 border-l-2 border-emerald-500 pl-3">
                "{c.quote}"
              </blockquote>
              <p className="text-bone-300 text-sm leading-relaxed pl-4">
                <span className="text-emerald-300 font-mono text-xs mr-2">→</span>
                {c.analysis}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({
  emoji,
  no,
  title,
  subtitle,
}: {
  emoji: string;
  no: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <h3 className="flex items-baseline gap-3 mb-3 border-b border-ink-500 pb-2">
      <span className="text-2xl">{emoji}</span>
      <span className="font-mono text-[10px] text-blood-300 tracking-[0.3em] uppercase">
        {no}
      </span>
      <span className="font-serif text-bone-100 text-lg">{title}</span>
      {subtitle && (
        <span className="font-mono text-[10px] text-bone-500 ml-auto">
          {subtitle}
        </span>
      )}
    </h3>
  );
}

function Loading({ phase }: { phase: number }) {
  const phases = [
    "녹취록 인덱싱",
    "진술 모순 검토",
    "회피 패턴 분석",
    "감정 기저선 추정",
    "최종 판정 작성",
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
        <h2 className="font-serif text-2xl text-bone-100 mb-4">
          분석에 실패했습니다
        </h2>
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
