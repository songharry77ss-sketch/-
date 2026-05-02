import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Msg = { role: "profiler" | "suspect"; content: string };
type CaseInfo = {
  suspectName: string;
  relation: string;
  situation: string;
  startedAt: string;
};

export type Verdict =
  | "TRUTHFUL" // 신뢰 가능
  | "PARTIAL" // 부분적 진실
  | "EVASIVE" // 회피·은폐 정황
  | "DECEPTIVE"; // 기만 정황

export type Report = {
  case_no: string;
  credibility: number; // 0-100
  consistency: number; // 0-100
  evasion: number; // 0-100
  emotional_baseline: string; // 1-line
  verdict: Verdict;
  one_line: string; // single sentence summary
  red_flags: { quote: string; analysis: string }[];
  consistencies: { quote: string; analysis: string }[]; // points that held up
  recommendation: string; // what the client should do next
};

const SCHEMA = {
  type: "object",
  properties: {
    credibility: {
      type: "integer",
      description: "전반적 진술의 신빙성 0-100 (높을수록 진실)",
    },
    consistency: {
      type: "integer",
      description: "내부 일관성 0-100 (높을수록 모순 적음)",
    },
    evasion: {
      type: "integer",
      description: "회피·방어 정도 0-100 (높을수록 회피 강함)",
    },
    emotional_baseline: {
      type: "string",
      description:
        "감정적 기저 한 줄 분석. 예: '방어적, 과잉 설명, 핵심 회피'",
    },
    verdict: {
      type: "string",
      enum: ["TRUTHFUL", "PARTIAL", "EVASIVE", "DECEPTIVE"],
      description: "최종 판정",
    },
    one_line: {
      type: "string",
      description: "한 문장 종합 결론. 차갑고 단정적인 어조.",
    },
    red_flags: {
      type: "array",
      description: "의심스러운 발언 인용과 분석. 2-4개.",
      items: {
        type: "object",
        properties: {
          quote: { type: "string", description: "진술자의 실제 발언 인용" },
          analysis: {
            type: "string",
            description: "왜 의심스러운지 한두 문장",
          },
        },
        required: ["quote", "analysis"],
        additionalProperties: false,
      },
    },
    consistencies: {
      type: "array",
      description: "신뢰할 만한 발언 인용과 이유. 1-3개. 없으면 빈 배열.",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          analysis: { type: "string" },
        },
        required: ["quote", "analysis"],
        additionalProperties: false,
      },
    },
    recommendation: {
      type: "string",
      description:
        "의뢰인에게 줄 다음 행동 권고. 2-3문장. 차분하고 실용적인 톤.",
    },
  },
  required: [
    "credibility",
    "consistency",
    "evasion",
    "emotional_baseline",
    "verdict",
    "one_line",
    "red_flags",
    "consistencies",
    "recommendation",
  ],
  additionalProperties: false,
};

function buildPrompt(caseInfo: CaseInfo, messages: Msg[]) {
  const transcript = messages
    .map((m) => {
      const tag = m.role === "profiler" ? "[프로파일러]" : `[${caseInfo.suspectName}]`;
      return `${tag} ${m.content}`;
    })
    .join("\n\n");

  return `당신은 25년 경력의 행동 분석 전문 프로파일러 김재현이다. 방금 끝난 심문의 녹취록을 검토하여 정식 보고서를 작성한다.

[사건 정보]
- 대상: ${caseInfo.suspectName} (관계: ${caseInfo.relation})
- 의심 정황: ${caseInfo.situation}

[심문 녹취록]
${transcript}

위 녹취록을 분석하여 보고서 JSON을 생성하라.

규칙:
- 점수는 보수적으로. 100점 만점 80% 이상은 매우 강한 증거가 있을 때만.
- red_flags의 quote는 반드시 ${caseInfo.suspectName}의 실제 발언에서 *그대로 인용*한다.
- analysis는 단정적이지만 절제된 톤. "회피 정황", "감정적 과잉 반응", "핵심 시점 결락" 같은 전문 어휘 사용.
- one_line은 영화적이지만 과장 없이. 예: "그는 거짓을 말하고 있다. 다만, 그것이 무엇을 숨기기 위한 것인지는 본인만이 안다."
- recommendation은 실용적. "직접 대면하지 말고 X부터 확인하라" 같은 구체적인 다음 행동.
- 한국어로 작성한다.`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const { caseInfo, messages } = (await req.json()) as {
    caseInfo: CaseInfo;
    messages: Msg[];
  };

  const client = new Anthropic();
  const prompt = buildPrompt(caseInfo, messages);

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      tools: [
        {
          name: "submit_report",
          description: "최종 분석 보고서를 제출한다.",
          input_schema: SCHEMA as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_report" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) throw new Error("보고서 형식 오류");
    const parsed = toolUse.input as Record<string, unknown>;
    const case_no = `K-${Math.floor(10000 + Math.random() * 90000)}-${String.fromCharCode(
      65 + Math.floor(Math.random() * 26)
    )}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;

    return Response.json({ case_no, ...parsed } as Report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "분석 실패";
    return Response.json({ error: msg }, { status: 500 });
  }
}
