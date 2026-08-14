import { NextResponse } from "next/server";

import {
  AdminDreamNotFoundError,
  AdminDreamValidationError,
  deleteAdminDream,
  parseAdminDreamUpdateInput,
  updateAdminDream,
} from "@/lib/api/admin/dreams";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR";

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

// 이 프로젝트에 [id] 동적 세그먼트를 다루는 기존 API Route가 없어(app/api/admin/draws는
// round를 body로 받지 URL 파라미터로 받지 않음), REST 컨벤션(app/api/profile/route.ts의
// PUT/DELETE 성격)만 참고하고 새 패턴을 발명하지 않았다 — id 파싱/검증도 다른 Route들과
// 동일한 "화이트리스트 후 명시적 타입 확인" 원칙을 그대로 적용한다.
function parseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PUT /api/admin/dreams/[id] — 꿈해몽 수정(Phase9-3).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  if (!(await isAdmin())) {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return errorResponse(400, "VALIDATION_ERROR", "id는 양의 정수여야 합니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  try {
    const input = await parseAdminDreamUpdateInput(jsonResult.body);
    const dream = await updateAdminDream(id, input);
    return NextResponse.json({ data: dream });
  } catch (error) {
    if (error instanceof AdminDreamValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof AdminDreamNotFoundError) {
      return errorResponse(404, "NOT_FOUND", error.message);
    }
    console.error("[PUT /api/admin/dreams/[id]] 수정 실패", { adminUserId: user.id, id, error });
    return errorResponse(500, "INTERNAL_ERROR", "꿈 수정 중 오류가 발생했습니다.");
  }
}

// DELETE /api/admin/dreams/[id] — 꿈해몽 삭제(Phase9-3). dream_number_mappings는
// ON DELETE CASCADE로 함께 삭제된다(lib/api/admin/dreams.ts 주석, 0003_dreams.sql 원문 확인
// — 이 Route가 별도로 매핑을 지우지 않는다).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  if (!(await isAdmin())) {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return errorResponse(400, "VALIDATION_ERROR", "id는 양의 정수여야 합니다.");
  }

  try {
    await deleteAdminDream(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AdminDreamNotFoundError) {
      return errorResponse(404, "NOT_FOUND", error.message);
    }
    console.error("[DELETE /api/admin/dreams/[id]] 삭제 실패", { adminUserId: user.id, id, error });
    return errorResponse(500, "INTERNAL_ERROR", "꿈 삭제 중 오류가 발생했습니다.");
  }
}
