import { NextResponse } from "next/server";

import {
  AdminContentNotFoundError,
  AdminContentValidationError,
  deleteContentEntry,
  DuplicateGuideTitleError,
  parseAdminContentUpdateInput,
  updateContentEntry,
} from "@/lib/api/admin/content";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DUPLICATE_GUIDE_TITLE"
  | "INTERNAL_ERROR";

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

// app/api/admin/dreams/[id]/route.ts(Phase9-3)와 동일한 id 파싱 컨벤션 — content_entries.id도
// bigint identity라 dreams.id와 동일한 형식(양의 정수)이다.
function parseId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PUT /api/admin/content/[id] — FAQ/가이드 수정(Phase9-6).
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
    const input = parseAdminContentUpdateInput(jsonResult.body);
    const entry = await updateContentEntry(id, input);
    return NextResponse.json({ data: entry });
  } catch (error) {
    if (error instanceof AdminContentValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof AdminContentNotFoundError) {
      return errorResponse(404, "NOT_FOUND", error.message);
    }
    if (error instanceof DuplicateGuideTitleError) {
      return errorResponse(409, "DUPLICATE_GUIDE_TITLE", error.message);
    }
    console.error("[PUT /api/admin/content/[id]] 수정 실패", { adminUserId: user.id, id, error });
    return errorResponse(500, "INTERNAL_ERROR", "콘텐츠 수정 중 오류가 발생했습니다.");
  }
}

// DELETE /api/admin/content/[id] — FAQ/가이드 삭제(Phase9-6). content_entries를 참조하는 다른
// 테이블이 없어(신규 테이블) CASCADE 고려사항 자체가 없다.
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
    await deleteContentEntry(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AdminContentNotFoundError) {
      return errorResponse(404, "NOT_FOUND", error.message);
    }
    console.error("[DELETE /api/admin/content/[id]] 삭제 실패", { adminUserId: user.id, id, error });
    return errorResponse(500, "INTERNAL_ERROR", "콘텐츠 삭제 중 오류가 발생했습니다.");
  }
}
