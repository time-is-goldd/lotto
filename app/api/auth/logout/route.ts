import { NextResponse } from "next/server";

import { logout } from "@/lib/auth/logout";

// POST /api/auth/logout — 상태를 변경하는 요청이라 GET이 아니라 POST로 노출한다
// (docs/AI_ENGINEERING_CONSTITUTION.md §11 CSRF 원칙, GET 기반 상태변경 금지).
// app/api/profile/route.ts와 동일한 패턴 — JSON만 반환하고, 이동/새로고침은 호출부(클라이언트)가
// 담당한다(app/onboarding/OnboardingForm.tsx가 router.push()를 직접 호출하는 것과 동일한 이유).
export async function POST() {
  try {
    await logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/auth/logout] 로그아웃 실패", { error });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "로그아웃 중 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
