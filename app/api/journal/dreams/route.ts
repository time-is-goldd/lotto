import { NextResponse } from "next/server";

import { JournalValidationError, createDreamJournalEntry, parseDreamJournalInput } from "@/lib/api/journal";
import { getCurrentUser } from "@/lib/auth/session";

// 이 라우트 전용 공통 에러 응답 형태 — app/api/numbers/route.ts와 동일한 컨벤션.
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

// POST /api/journal/dreams — 개인 꿈 기록 작성(Phase7-4). user_id는 요청 본문에서 전혀 읽지
// 않고 getCurrentUser()로만 결정한다(app/api/numbers/route.ts와 동일한 원칙).
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  let input: ReturnType<typeof parseDreamJournalInput>;
  try {
    input = parseDreamJournalInput(jsonResult.body);
  } catch (error) {
    if (error instanceof JournalValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  try {
    const entry = await createDreamJournalEntry(user.id, input.dreamText, input.linkedDreamId);
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    // linkedDreamId 형식은 유효하지만 실제로 존재하지 않는 꿈을 가리키는 경우도
    // JournalValidationError로 던져진다(lib/api/journal.ts).
    if (error instanceof JournalValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    console.error("[POST /api/journal/dreams] 저장 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "꿈 기록 저장 중 오류가 발생했습니다.");
  }
}
