import { NextResponse } from "next/server";

import {
  AdminContentValidationError,
  createContentEntry,
  DuplicateGuideTitleError,
  getAdminContentEntries,
  parseAdminContentCreateInput,
  type ContentEntryType,
} from "@/lib/api/admin/content";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

// app/api/admin/dreams/route.ts(Phase9-3)와 동일한 컨벤션 — 인증 순서(비로그인 401 →
// 비관리자 403 → 입력 검증 400 → 실행)와 에러 응답 형태를 그대로 재사용한다.
type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
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

function parseTypeQueryParam(request: Request): { type?: ContentEntryType } | { errorResponse: NextResponse } {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("type");
  if (raw === null) {
    return {};
  }
  if (raw !== "faq" && raw !== "guide") {
    return {
      errorResponse: errorResponse(400, "VALIDATION_ERROR", "type은 faq 또는 guide여야 합니다."),
    };
  }
  return { type: raw };
}

// GET /api/admin/content?type=faq|guide — FAQ/가이드 목록 조회(Phase9-6). content_entries는
// 공개 SELECT RLS 정책이 없어(0014_content_entries.sql) 관리자 인증을 통과한 요청만 조회할 수
// 있다.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }
  if (!(await isAdmin())) {
    return errorResponse(403, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
  }

  const typeResult = parseTypeQueryParam(request);
  if ("errorResponse" in typeResult) {
    return typeResult.errorResponse;
  }

  try {
    const entries = await getAdminContentEntries(typeResult.type);
    return NextResponse.json({ data: entries });
  } catch (error) {
    console.error("[GET /api/admin/content] 조회 실패", { adminUserId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "콘텐츠 조회 중 오류가 발생했습니다.");
  }
}

// POST /api/admin/content — FAQ/가이드 생성(Phase9-6). user_id 개념이 없는 관리자 전용 콘텐츠라
// app/api/admin/dreams/route.ts처럼 클라이언트가 소유권 필드를 보낼 여지 자체가 없다 — created_at/
// updated_at도 parseAdminContentCreateInput이 화이트리스트에 없는 필드는 전부 무시하므로 클라이언트가
// 보내도 저장 대상이 되지 않는다.
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

  try {
    const input = parseAdminContentCreateInput(jsonResult.body);
    const entry = await createContentEntry(input);
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminContentValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof DuplicateGuideTitleError) {
      return errorResponse(409, "DUPLICATE_GUIDE_TITLE", error.message);
    }
    console.error("[POST /api/admin/content] 생성 실패", { adminUserId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "콘텐츠 생성 중 오류가 발생했습니다.");
  }
}
