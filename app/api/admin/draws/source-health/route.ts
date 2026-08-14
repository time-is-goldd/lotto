import { NextResponse } from "next/server";

import { checkLottoSourceHealth } from "@/lib/api/admin/lottoSourceHealth";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

// POST /api/admin/draws/source-health — 지시문 §22 "출처 상태 확인" 기능. app/api/admin/draws/
// sync/route.ts와 동일한 인증 순서를 그대로 재사용한다. checkLottoSourceHealth()
// (lib/api/admin/lottoSourceHealth.ts)는 구조적으로 DB에 쓰기 작업을 할 수 없다(registerDrawAndMatchUserNumbers를
// import조차 하지 않음) — 이 Route도 그 함수만 호출하고 그 외 아무 것도 하지 않는다.
export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
      { status: 401 }
    );
  }

  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "관리자만 접근할 수 있습니다." } },
      { status: 403 }
    );
  }

  try {
    const report = await checkLottoSourceHealth();
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error("[POST /api/admin/draws/source-health] 출처 상태 확인 실패", {
      adminUserId: user.id,
      error,
    });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "출처 상태를 확인하지 못했습니다." } },
      { status: 500 }
    );
  }
}
