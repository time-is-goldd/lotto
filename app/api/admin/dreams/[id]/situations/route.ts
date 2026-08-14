import { NextResponse } from "next/server";

import { AdminDreamNotFoundError } from "@/lib/api/admin/dreams";
import {
  AdminDreamSituationValidationError,
  createAdminDreamSituation,
  DuplicateSituationKeywordError,
  parseAdminDreamSituationCreateInput,
} from "@/lib/api/admin/dreamSituations";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

// app/api/admin/dreams/route.ts와 완전히 동일한 컨벤션(인증 순서, 에러 응답 형태)을 그대로
// 재사용한다. CONFLICT(409)만 추가됐다 — situation은 (dream_id, keyword) UNIQUE 제약이 있어
// (0018_dream_situations.sql) 부모 Dream(dreams.keyword는 UNIQUE 제약이 없음)과 달리 실제로
// 중복이 DB 레벨에서 거부될 수 있다(지시문 §8).
type ErrorCode =
  "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";

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

// app/api/admin/dreams/[id]/route.ts와 동일한 이유·동일한 구현 — 이 라우트가 이미 "id"라는
// 세그먼트 이름으로 부모 Dream을 가리키므로(Next.js는 같은 경로 위치에서 서로 다른 동적
// 세그먼트 이름을 허용하지 않는다), 하위 situations 라우트도 반드시 같은 이름("id")을
// 재사용해야 한다 — "dreamId"로 새로 짓지 않는다.
function parseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// POST /api/admin/dreams/[id]/situations — 세부 상황 생성(Phase10-4E). 부모 Dream id는
// 항상 이 URL 세그먼트에서만 가져온다 — 요청 본문에 dream_id/dreamId 필드가 있어도
// parseAdminDreamSituationCreateInput()이 아예 읽지 않는다(지시문 §4, lib/api/admin/
// dreamSituations.ts 주석 참조).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  if (!(await isAdmin())) {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const { id: rawId } = await params;
  const dreamId = parseId(rawId);
  if (dreamId === null) {
    return errorResponse(400, "VALIDATION_ERROR", "id는 양의 정수여야 합니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  try {
    const input = parseAdminDreamSituationCreateInput(jsonResult.body);
    const situation = await createAdminDreamSituation(dreamId, input);
    return NextResponse.json({ data: situation }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminDreamSituationValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof DuplicateSituationKeywordError) {
      return errorResponse(409, "CONFLICT", error.message);
    }
    if (error instanceof AdminDreamNotFoundError) {
      return errorResponse(404, "NOT_FOUND", error.message);
    }
    console.error("[POST /api/admin/dreams/[id]/situations] 생성 실패", {
      adminUserId: user.id,
      dreamId,
      error,
    });
    return errorResponse(500, "INTERNAL_ERROR", "세부 상황 생성 중 오류가 발생했습니다.");
  }
}
