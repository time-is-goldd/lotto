import { NextResponse } from "next/server";

import {
  DreamNotFoundError,
  NumbersValidationError,
  parseDreamContext,
  parseNumbersInput,
  saveUserNumbers,
} from "@/lib/api/numbers";
import { getCurrentUser } from "@/lib/auth/session";

// 이 라우트 전용 공통 에러 응답 형태 — app/api/profile/route.ts와 동일한 컨벤션
// (두 번째 이후 라우트가 더 생기면 그때 공용 모듈로 추출한다, 지금은 과도한 추상화 지양).
type ErrorCode = "UNAUTHORIZED" | "VALIDATION_ERROR" | "INTERNAL_ERROR";

function errorResponse(status: number, code: ErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function readJsonBody(
  request: Request
): Promise<{ body: unknown } | { errorResponse: NextResponse }> {
  try {
    return { body: await request.json() };
  } catch {
    return {
      errorResponse: errorResponse(400, "VALIDATION_ERROR", "요청 본문이 올바른 JSON이 아닙니다."),
    };
  }
}

// POST /api/numbers — lib/logic/generateNumbers()로 클라이언트가 이미 생성한 번호를
// 저장한다. 서버는 번호를 다시 생성하지 않는다(docs/PHASE5_GENERATE_LOGIC_REPORT.md §8).
// user_id는 요청 본문에서 전혀 읽지 않고 getCurrentUser()로만 결정한다
// (docs/PHASE4_ARCHITECTURE_DECISION.md·app/api/profile/route.ts와 동일한 원칙).
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  let numbers: number[];
  let dreamContext: ReturnType<typeof parseDreamContext>;
  try {
    numbers = parseNumbersInput(jsonResult.body);
    // Phase7-3: 꿈 연동 정보(generationMethod/relatedDreamId)는 선택적이다. 기존 클라이언트가
    // 이 필드를 보내지 않으면 parseDreamContext()가 기존과 동일한 "auto" 기본값을 반환해
    // 일반 번호 생성 흐름은 전혀 바뀌지 않는다(docs/PHASE7_DREAM_NUMBER_INTEGRATION_REPORT.md §3).
    dreamContext = parseDreamContext(jsonResult.body);
  } catch (error) {
    if (error instanceof NumbersValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  try {
    const entry = await saveUserNumbers(user.id, numbers, dreamContext);
    return NextResponse.json(
      { data: { id: entry.id, numbers: entry.numbers, created_at: entry.created_at } },
      { status: 201 }
    );
  } catch (error) {
    // relatedDreamId가 형식은 유효하지만 실제로 존재하지 않는 꿈을 가리키는 경우
    // (삭제됐거나 위조된 값) — saveUserNumbers()가 INSERT 전에 검증해 던진다.
    if (error instanceof DreamNotFoundError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    console.error("[POST /api/numbers] 저장 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "번호 저장 중 오류가 발생했습니다.");
  }
}
