import { NextResponse } from "next/server";

import { getDerivedFortuneFields, getOrCreateTodayFortune } from "@/lib/api/fortune";
import { getProfile } from "@/lib/auth/profile";
import { getCurrentUser } from "@/lib/auth/session";

// 이 라우트 전용 공통 에러 응답 형태 — app/api/profile/route.ts와 동일한 컨벤션.
type ErrorCode = "UNAUTHORIZED" | "PROFILE_NOT_FOUND" | "INTERNAL_ERROR";

function errorResponse(status: number, code: ErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// POST /api/fortune/today — 오늘의 행운 조회/생성(generate-or-get, §14). 요청 본문을 전혀
// 읽지 않는다 — user_id는 getCurrentUser()로만 결정하고(app/api/numbers/route.ts와 동일한
// 원칙), birth_date도 클라이언트 입력이 아니라 서버가 profiles에서 직접 읽는다. 같은 날
// 다시 호출해도 새로 생성하지 않고 기존 결과를 그대로 반환한다(§22 "다시 뽑기" 없음) —
// GET이 아니라 POST인 이유는 최초 호출 시 실제로 행이 하나 생성될 수 있어서다(생성/조회를
// 하나의 idempotent 동작으로 묶음).
export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    return errorResponse(
      404,
      "PROFILE_NOT_FOUND",
      "profile이 존재하지 않습니다. 온보딩을 먼저 완료해주세요."
    );
  }

  try {
    const { entry, isNew } = await getOrCreateTodayFortune(
      user.id,
      profile.birth_date,
      profile.gender,
      profile.birth_time
    );
    const { luckyNumbers, moneyLuckScore } = getDerivedFortuneFields(
      entry,
      profile.birth_date,
      profile.gender,
      profile.birth_time
    );

    return NextResponse.json(
      { data: { ...entry, luckyNumbers, moneyLuckScore, isNew } },
      { status: isNew ? 201 : 200 }
    );
  } catch (error) {
    console.error("[POST /api/fortune/today] 조회/생성 실패", { userId: user.id, error });
    return errorResponse(500, "INTERNAL_ERROR", "오늘의 행운을 불러오는 중 오류가 발생했습니다.");
  }
}
