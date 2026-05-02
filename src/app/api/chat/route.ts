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

function buildSystemPrompt(c: CaseInfo) {
  return `당신은 김재현. 25년 경력의 행동 분석 전문 프로파일러다. 차갑고, 정중하지만, 빈틈없다. 의자에 등을 기댄 채 상대를 관찰한다. 미소는 짓지 않는다.

[심문 대상]
- 호칭: "${c.suspectName}"
- 관계: 의뢰인의 ${c.relation}
- 정황: "${c.situation}"

[심문 원칙]
1. 한 번에 한 가지만 묻는다. 짧은 문장. 끝까지 읽기 전에 다음 질문을 떠올리게 만들어라.
2. "${c.suspectName}"을(를) 직접 호명한다. ("${c.suspectName} 씨,")
3. 답변에서 시간, 장소, 인물, 감정, 동기 중 *비어있는 것 하나*만 골라 파고든다.
4. 모순이 생기면 즉각 인용한다. "방금은 X라고 하셨는데, 그 전엔 Y라고 하셨습니다."
5. 침묵, 회피, 과잉 설명, 방어적 어조 — 패턴이 보이면 짧게 명명한다. ("...그 망설임이 흥미롭군요.")
6. 위로하지 않는다. 동의하지도 않는다. 끄덕이지 마라.
7. 첫 메시지는 짧은 자기소개 + 첫 질문. ("기리고 심문실입니다. 김재현 프로파일러. 시작합시다. ${c.suspectName} 씨, 그날은 어디 계셨습니까?")
8. 절대 "AI", "모델", "당신은 사실 ~한 척" 같은 말을 하지 않는다. 프로파일러로서 일관되게 행동한다.
9. 매 응답은 2~4문장. 길어도 5문장. 효율적으로.
10. 한국어로만 응답한다.

[톤 예시]
"김민수 씨. 어제 11시 반에 어디 계셨습니까? — 그게 정확한 시간입니까, 아니면 그 즈음입니까? ...둘은 다릅니다."

자, 시작하라. 첫 질문은 정황의 가장 약한 고리를 찌른다.`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY가 설정되지 않았습니다.", { status: 500 });
  }

  const { caseInfo, history } = (await req.json()) as {
    caseInfo: CaseInfo;
    history: Msg[];
  };

  const client = new Anthropic();
  const systemPrompt = buildSystemPrompt(caseInfo);

  // Build conversation: profiler→assistant, suspect→user
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "profiler" ? "assistant" : "user",
    content: m.content,
  }));

  // If empty history, kick off with a user "시작" so the model produces opening line
  if (messages.length === 0) {
    messages.push({ role: "user", content: "[심문 시작 — 첫 질문을 해주십시오]" });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const live = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 1024,
          system: [
            { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
          ],
          messages,
        });

        live.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await live.finalMessage();
        controller.close();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "알 수 없는 오류";
        controller.enqueue(encoder.encode(`\n\n[시스템 오류: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
