"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api, type Relation } from "@/lib/api";

const RELATIONS: Relation[] = ["연인", "배우자", "친구", "가족", "동료", "사제"];

const SCENARIOS = [
  { label: "늦은 귀가", text: "어제 새벽 2시에 들어왔는데, 어디서 뭘 했는지 설명이 매번 다릅니다. 처음엔 친구라더니, 다음엔 일이라고 합니다." },
  { label: "비밀 누설", text: "내가 저 사람한테만 말한 비밀을 다른 친구가 알고 있습니다. 추궁하니 '나는 말한 적 없다'고만 합니다." },
  { label: "수상한 메시지", text: "휴대폰 알림창에서 모르는 사람이 보낸 다정한 메시지를 봤습니다. 물어보니 '잘못 온 거다'라고 합니다." },
  { label: "사라진 물건", text: "내 서랍에서 현금이 없어졌고, 그 사람만이 들어올 수 있었습니다. 본인은 모른다고만 합니다." },
];

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation>("연인");
  const [situation, setSituation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length > 0;
  const situationOk = situation.trim().length >= 10;
  const canStart = nameOk && situationOk && !submitting;
  const completed = [nameOk, true, situationOk].filter(Boolean).length;

  const start = async () => {
    if (!canStart) return;
    setSubmitting(true);
    setError(null);
    try {
      const sess = await api.createSession({
        suspect_name: name.trim(),
        relation,
        situation: situation.trim(),
      });
      router.push(`/i/${sess.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "세션 생성 실패");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8 border-b border-ink-500 pb-3">
        <Link href="/" className="font-mono text-[11px] text-bone-300 hover:text-blood-300 tracking-widest transition-colors">
          ◀ 처음으로
        </Link>
        <span className="font-mono text-[10px] text-bone-500 tracking-[0.3em]">{completed}/3 입력 완료</span>
        <span className="font-mono text-[11px] text-blood-500">●  REC</span>
      </div>

      <h2 className="font-serif text-3xl text-bone-100 mb-1">사건 접수</h2>
      <p className="text-bone-300 text-sm mb-10">세 가지만 알려주시면, 프로파일러가 즉시 심문을 시작합니다.</p>

      <div className="space-y-7">
        <Field step="01" label="누구를 심문하시겠습니까?" hint="본명, 닉네임, 이니셜 — 자유롭게" done={nameOk}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 민수, 그 사람, J..."
            maxLength={20}
            className="w-full bg-ink-800 border border-ink-500 focus:border-blood-500 px-4 py-3.5 text-lg text-bone-100 placeholder-bone-500 transition-colors"
          />
        </Field>

        <Field step="02" label="당신과 어떤 사이입니까?" done>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRelation(r)}
                className={`px-5 py-2.5 border text-sm transition-colors ${
                  relation === r ? "border-blood-500 bg-blood-900/30 text-bone-100" : "border-ink-500 text-bone-300 hover:border-bone-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>

        <Field
          step="03"
          label="무슨 일이 있었나요?"
          hint="구체적일수록 심문이 정확해집니다 (최소 10자)"
          done={situationOk}
          counter={`${situation.length}/2000`}
        >
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="시간, 장소, 발견한 단서까지 적어주세요."
            maxLength={2000}
            rows={5}
            className="w-full bg-ink-800 border border-ink-500 focus:border-blood-500 px-4 py-3 text-bone-100 placeholder-bone-500 resize-none transition-colors leading-relaxed"
          />
          <div className="mt-3">
            <div className="font-mono text-[10px] text-bone-500 tracking-widest mb-2">▼ 예시 시나리오</div>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSituation(s.text)}
                  className="text-xs text-bone-300 hover:text-blood-300 border border-ink-500 hover:border-blood-700 hover:bg-blood-900/20 px-3 py-1.5 transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </Field>

        {error && (
          <div className="border border-blood-500 bg-blood-900/20 p-3 text-sm text-blood-200">
            <span className="font-mono text-[10px] tracking-widest">⚠ ERROR · </span>
            {error}
          </div>
        )}

        <button
          onClick={start}
          disabled={!canStart}
          className={`w-full py-5 font-mono text-sm tracking-[0.4em] uppercase border-2 transition-all ${
            canStart
              ? "border-blood-500 text-blood-300 hover:bg-blood-900 hover:text-bone-100 cursor-pointer glitch-on-hover"
              : "border-ink-500 text-bone-500 cursor-not-allowed"
          }`}
        >
          {submitting ? "세션 생성 중..." : canStart ? "▶ 심문실 입장" : `${3 - completed}개 더 입력하세요`}
        </button>

        <p className="text-[10px] font-mono text-bone-500 tracking-wider text-center leading-relaxed">
          입력하신 정보는 분석에만 사용되며, 본 보고서는 참고용 — 법적 효력 없음.
        </p>
      </div>
    </main>
  );
}

function Field({
  step, label, hint, counter, done, children,
}: {
  step: string; label: string; hint?: string; counter?: string; done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <label className="flex items-baseline gap-3">
          <span className={`font-mono text-[11px] tracking-[0.3em] transition-colors ${done ? "text-emerald-400" : "text-blood-300"}`}>
            {done ? "✓" : "▶"} {step}
          </span>
          <span className="text-bone-100 text-base font-medium">{label}</span>
        </label>
        {counter && <span className="font-mono text-[10px] text-bone-500">{counter}</span>}
      </div>
      {children}
      {hint && <p className="text-[10px] font-mono text-bone-500 mt-1.5 tracking-wider">{hint}</p>}
    </div>
  );
}
