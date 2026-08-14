import { NextResponse } from "next/server";

import {
  AdminDreamSituationNotFoundError,
  AdminDreamSituationValidationError,
  deleteAdminDreamSituation,
  DuplicateSituationKeywordError,
  parseAdminDreamSituationUpdateInput,
  updateAdminDreamSituation,
} from "@/lib/api/admin/dreamSituations";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

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

function parseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PUT/DELETE 둘 다 dreamId(URL "id" 세그먼트)와 situationId 두 값을 모두 파싱해야
// 소유권 검증(지시문 §13)을 lib/api/admin/dreamSituations.ts에 그대로 넘길 수 있다 — 이
// Route는 두 id를 숫자로 파싱하는 것 이상의 소유권 판단을 직접 하지 않는다(그 판단은
// updateAdminDreamSituation/deleteAdminDreamSituation의 WHERE id + dream_id 조합이
// 전담한다, 중복 로직 없음).
function parseIds(
  rawDreamId: string,
  rawSituationId: string
): { dreamId: number; situationId: number } | null {
  const dreamId = parseId(rawDreamId);
  const situationId = parseId(rawSituationId);
  if (dreamId === null || situationId === null) {
    return null;
  }
  return { dreamId, situationId };
}

// PUT /api/admin/dreams/[id]/situations/[situationId] — 세부 상황 수정(Phase10-4E).
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; situationId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  if (!(await isAdmin())) {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const { id: rawId, situationId: rawSituationId } = await params;
  const ids = parseIds(rawId, rawSituationId);
  if (ids === null) {
    return errorResponse(400, "VALIDATION_ERROR", "id/situationId는 양의 정수여야 합니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  try {
    const input = parseAdminDreamSituationUpdateInput(jsonResult.body);
    const situation = await updateAdminDreamSituation(ids.dreamId, ids.situationId, input);
    return NextResponse.json({ data: situation });
  } catch (error) {
    if (error instanceof AdminDreamSituationValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof DuplicateSituationKeywordError) {
      return errorResponse(409, "CONFLICT", error.message);
    }
    if (error instanceof AdminDreamSituationNotFoundError) {
      return errorResponse(404, "NOT_FOUND", error.message);
    }
    console.error("[PUT /api/admin/dreams/[id]/situations/[situationId]] 수정 실패", {
      adminUserId: user.id,
      ...ids,
      error,
    });
    return errorResponse(500, "INTERNAL_ERROR", "세부 상황 수정 중 오류가 발생했습니다.");
  }
}

// DELETE /api/admin/dreams/[id]/situations/[situationId] — 세부 상황 삭제(Phase10-4E).
// dream_situations는 자식 행이 없어(0018) 이 Route가 별도로 정리할 관련 테이블이 없다 —
// dreams 삭제 시 dream_number_mappings를 신경 쓰지 않아도 되는 것과 같은 이유
// (app/api/admin/dreams/[id]/route.ts 주석 참조).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; situationId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  if (!(await isAdmin())) {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const { id: rawId, situationId: rawSituationId } = await params;
  const ids = parseIds(rawId, rawSituationId);
  if (ids === null) {
    return errorResponse(400, "VALIDATION_ERROR", "id/situationId는 양의 정수여야 합니다.");
  }

  try {
    await deleteAdminDreamSituation(ids.dreamId, ids.situationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AdminDreamSituationNotFoundError) {
      return errorResponse(404, "NOT_FOUND", error.message);
    }
    console.error("[DELETE /api/admin/dreams/[id]/situations/[situationId]] 삭제 실패", {
      adminUserId: user.id,
      ...ids,
      error,
    });
    return errorResponse(500, "INTERNAL_ERROR", "세부 상황 삭제 중 오류가 발생했습니다.");
  }
}
