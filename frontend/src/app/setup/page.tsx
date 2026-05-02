"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api, type Relation } from "@/lib/api";

const RELATIONS: Relation[] = ["연인", "배우자", "친구", "가족", "동료", "사제"];

const SCENARIOS = [
  {
    label: "💔 연인 — 늦은 귀가",
    text:
      "어제 새벽 2시 17분에 집에 들어왔습니다. 평소 11시쯤 들어오는데 연락도 없이 늦었고, 들어오자마자 바로 화장실로 가서 한참 있다가 나왔어요. 어디서 뭐 했냐고 물으니 처음엔 '회사 동료들이랑 술'이라고 했다가, 누구냐고 다시 물으니 '그냥 친구'라고 말이 바뀌었습니다. 옷에서 처음 맡아보는 향수 냄새가 났고, 휴대폰을 평소처럼 거실에 안 두고 침대 밑으로 가져갔습니다.",
  },
  {
    label: "💔 연인 — 수상한 메시지",
    text:
      "그 사람이 샤워하는 동안 휴대폰 화면이 켜졌는데, '오늘 너무 좋았어 ❤️'라는 메시지가 와있었습니다. 발신자는 저장 안 된 010-XXXX-XXXX 번호였고요. 끝나고 물어보니 '회사 거래처 직원이 잘못 보낸 거'라고 합니다. 그런데 다음 날 그 번호로 다시 검색해보니 인스타에서 본인 계정과 서로 팔로우 상태였어요. 사진도 둘이 같이 찍은 게 한 장 있었고요. 본인은 '그냥 회식 사진'이라고 합니다.",
  },
  {
    label: "👫 친구 — 비밀 누설",
    text:
      "제가 저 친구한테만 털어놓은 가족 문제를 다른 친구 두 명이 알고 있었습니다. 둘 다 '소문 들었다'고만 하고 출처는 안 알려줘요. 추궁하니 처음엔 '나 절대 말 안 했어'라고 단호하게 부정하다가, 한 시간 뒤에 '근데 한 명한테 진지하게 걱정돼서 말한 적은 있어'라고 말을 바꿨습니다. 그 한 명은 누구냐고 물으니 '기억 안 나'라고 합니다.",
  },
  {
    label: "👫 친구 — 빌린 돈",
    text:
      "두 달 전에 30만원 빌려갔는데 다음 주에 갚는다고 했습니다. 그 후로 만날 때마다 잊은 척하다가, 카톡으로 물어보면 '읽씹'합니다. 어제 만났을 때 직접 물으니 '아 미안 다음 주에 진짜 줄게'라고 했는데, 동시에 새 신발과 명품 가방을 사놓은 걸 봤어요. 이런 적이 처음이 아니라 작년에도 비슷한 일이 한 번 있었습니다.",
  },
  {
    label: "👨‍👩‍👧 가족 — 카드 사용",
    text:
      "엄마 명의 카드에서 평소 안 가던 곳들에서 결제 내역이 떴습니다. 백화점 화장품 50만원, 호텔 70만원 등. 동생한테 물으니 '나 모르는 일'이라고 하는데, 카드 한도 내역을 보니 정확히 동생이 학원 끝나는 시간에 결제됐고, 결제 위치도 동생 학원 근처입니다. 동생 방에서 새 화장품들이 보이긴 했는데 '친구가 줬다'고 합니다.",
  },
  {
    label: "🏢 직장 — 책임 회피",
    text:
      "회사 프로젝트에서 데이터 누락 사고가 났는데, 그 부분 담당자였던 후배가 '저는 그 폴더에 접근 권한이 없었다'고 주장합니다. 하지만 사고 발생 30분 전 로그에 후배 계정으로 그 폴더에 접근한 기록이 있어요. 보여주니 '계정을 누가 도용한 것 같다'고 하고, 그 시간에 어디 있었냐고 물으니 '회의실에서 통화 중이었다'고 합니다. 회의실 사용 기록에는 그 시간에 예약이 없습니다.",
  },
  {
    label: "🎓 사제 — 시험 부정",
    text:
      "기말고사에서 한 학생이 평소 성적과 너무 다르게 만점에 가까운 답안을 냈습니다. 답지 패턴이 옆자리 모범생 답지와 거의 동일했고, 같은 자리에서 같은 실수까지 했어요. 따로 불러서 물으니 '집에서 정말 열심히 공부했다'고만 합니다. 어떻게 공부했냐고 물으니 '인강 봤다'는데 무슨 강의냐고 물으면 답을 못 합니다.",
  },
  {
    label: "👫 친구 — 약속 펑크",
    text:
      "한 달 전부터 잡은 중요한 약속을 당일 1시간 전에 '갑자기 가족이 아프다'며 취소했습니다. 그날 저녁 다른 공통 친구의 SNS에 그 친구가 다른 모임에서 신나게 노는 사진이 올라왔어요. 이튿날 물으니 '응급실 갔다가 잠깐 들른 거'라고 하는데, 어느 응급실이었냐고 묻자 '기억 안 난다'고 답합니다. 비슷한 일이 작년에도 두 번 있었습니다.",
  },
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
            <div className="font-mono text-[10px] text-bone-500 tracking-widest mb-2">
              ▼ 예시 시나리오 (클릭하면 자동으로 채워집니다)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCENARIOS.map((s, i) => {
                const selected = situation === s.text;
                return (
                  <button
                    key={i}
                    onClick={() => setSituation(s.text)}
                    title={s.text}
                    className={`text-left text-xs px-3 py-2 transition-colors border ${
                      selected
                        ? "border-blood-500 bg-blood-900/30 text-bone-100"
                        : "border-ink-500 text-bone-300 hover:border-blood-700 hover:bg-blood-900/20 hover:text-bone-100"
                    }`}
                  >
                    <div className="font-medium leading-snug">{s.label}</div>
                    <div className="text-[10px] text-bone-500 mt-1 line-clamp-2 leading-snug">
                      {s.text}
                    </div>
                  </button>
                );
              })}
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
