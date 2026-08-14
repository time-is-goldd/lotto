import { NextResponse } from "next/server";

import {
  AdminDrawsValidationError,
  DuplicateRoundError,
  parseAdminDrawsInput,
  registerDrawAndMatchUserNumbers,
} from "@/lib/api/admin/draws";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

// 이 라우트 전용 공통 에러 응답 형태 — app/api/profile/route.ts와 동일한 컨벤션.
type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "DUPLICATE_ROUND" | "INTERNAL_ERROR";

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

// POST /api/admin/draws — 관리자가 회차 결과를 입력하면 lib/api/admin/draws.ts의
// registerDrawAndMatchUserNumbers()(Phase6-3, 수정 없이 그대로 재사용)가 draws 저장과
// user_numbers 일괄 대조를 수행한다. 이 파일은 인증/인가/입력 파싱/에러 매핑만 담당하고
// 판정 로직을 다시 구현하지 않는다(docs/PHASE6_ADMIN_DRAW_ROUTE_REPORT.md §6).
//
// 인증 순서(docs/PHASE6_ADMIN_AUTH_DECISION.md §8): 비로그인(401) → 비관리자(403) → 입력
// 검증(400) → 배치 실행(성공/409/500). 이 프로젝트의 기존 API(app/api/numbers/route.ts,
// app/api/profile/route.ts)가 전부 "인증 먼저, JSON 파싱은 그다음" 순서를 쓰므로 그 컨벤션을
// 그대로 따른다. user_id는 요청 본문 어디에서도 읽지 않는다 — 관리자 판정은 isAdmin()이
// getCurrentUser()로 확인한 현재 세션만 근거로 한다(클라이언트가 보낸 어떤 값도 신뢰하지
// 않음, Decision "UID 하드코딩/이메일 비교 금지"와 일치).
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  if (!(await isAdmin())) {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  let input: ReturnType<typeof parseAdminDrawsInput>;
  try {
    input = parseAdminDrawsInput(jsonResult.body);
  } catch (error) {
    if (error instanceof AdminDrawsValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  try {
    const result = await registerDrawAndMatchUserNumbers(input);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateRoundError) {
      return errorResponse(409, "DUPLICATE_ROUND", error.message);
    }
    console.error("[POST /api/admin/draws] 회차 등록/대조 실패", { adminUserId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "회차 등록 중 오류가 발생했습니다.");
  }
}
