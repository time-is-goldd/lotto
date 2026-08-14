import { NextResponse } from "next/server";

import {
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
  ProfileValidationError,
  createProfile,
  getProfile,
  parseProfileCreateInput,
  parseProfileUpdateInput,
  updateProfile,
} from "@/lib/auth/profile";
import { getCurrentUser, resolveProfileProvider } from "@/lib/auth/session";

// 이 라우트 전용 공통 에러 응답 형태. 두 번째 API Route가 생기면 그때 공용 모듈로 추출한다
// (지금은 사용처가 하나뿐이라 미리 분리하지 않는다 — 과도한 추상화 지양).
type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_ALREADY_EXISTS"
  | "VALIDATION_ERROR"
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

// GET /api/profile — 현재 로그인 사용자의 profile 조회
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  try {
    const profile = await getProfile(user.id);

    if (!profile) {
      return errorResponse(
        404,
        "PROFILE_NOT_FOUND",
        "profile이 존재하지 않습니다. 온보딩을 완료해주세요."
      );
    }

    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error("[GET /api/profile] 조회 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "profile 조회 중 오류가 발생했습니다.");
  }
}

// POST /api/profile — 최초 profile 생성(service_role 경유, docs/PHASE2_AUTH_DECISION.md Decision 1)
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  let input: ReturnType<typeof parseProfileCreateInput>;
  try {
    input = parseProfileCreateInput(jsonResult.body);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  try {
    const provider = resolveProfileProvider(user);
    const profile = await createProfile(user.id, provider, input);
    return NextResponse.json({ data: profile }, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileAlreadyExistsError) {
      return errorResponse(409, "PROFILE_ALREADY_EXISTS", "profile이 이미 존재합니다.");
    }
    console.error("[POST /api/profile] 생성 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "profile 생성 중 오류가 발생했습니다.");
  }
}

// PUT /api/profile — profile 수정(민감 컬럼 화이트리스트 적용, service_role 경유)
export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const jsonResult = await readJsonBody(request);
  if ("errorResponse" in jsonResult) {
    return jsonResult.errorResponse;
  }

  let input: ReturnType<typeof parseProfileUpdateInput>;
  try {
    input = parseProfileUpdateInput(jsonResult.body);
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  try {
    const profile = await updateProfile(user.id, input);
    return NextResponse.json({ data: profile });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return errorResponse(
        404,
        "PROFILE_NOT_FOUND",
        "profile이 존재하지 않습니다. 온보딩을 먼저 완료해주세요."
      );
    }
    console.error("[PUT /api/profile] 수정 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "profile 수정 중 오류가 발생했습니다.");
  }
}
