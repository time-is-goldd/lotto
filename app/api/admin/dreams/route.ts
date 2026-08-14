import { NextResponse } from "next/server";

import { AdminDreamValidationError, createAdminDream, parseAdminDreamCreateInput } from "@/lib/api/admin/dreams";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

// app/api/admin/draws/route.ts(Phase6-4-2)와 동일한 컨벤션 — 인증 순서(비로그인 401 →
// 비관리자 403 → 입력 검증 400 → 실행)와 에러 응답 형태를 그대로 재사용한다.
type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "INTERNAL_ERROR";

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

// POST /api/admin/dreams — 꿈해몽 생성(Phase9-3). user_id 개념이 없는 공개 콘텐츠라
// app/api/admin/draws/route.ts처럼 클라이언트가 소유권 필드를 보낼 여지 자체가 없다 —
// 그래도 인증/인가 순서는 동일하게 유지한다.
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
    const input = await parseAdminDreamCreateInput(jsonResult.body);
    const dream = await createAdminDream(input);
    return NextResponse.json({ data: dream }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminDreamValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    console.error("[POST /api/admin/dreams] 생성 실패", { adminUserId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "꿈 생성 중 오류가 발생했습니다.");
  }
}
