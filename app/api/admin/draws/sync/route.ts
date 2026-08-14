import { NextResponse } from "next/server";

import { syncOfficialLottoDraws } from "@/lib/api/admin/lottoSync";
import { isAdmin } from "@/lib/auth/isAdmin";
import { getCurrentUser } from "@/lib/auth/session";

// POST /api/admin/draws/sync — 지시문 §21 "Admin Manual Sync" fallback. app/api/admin/draws/
// route.ts와 완전히 동일한 인증 순서(비로그인 401 → 비관리자 403)를 재사용한다. Cron
// (app/api/cron/sync-lotto/route.ts)과 정확히 같은 syncOfficialLottoDraws()를 호출한다 —
// 이 라우트 자신은 회차 판단/충돌 감지/등록 로직을 전혀 갖지 않는다(지시문 §21 "Cron과
// Admin이 서로 다른 로직을 사용하면 안 된다").
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
    const result = await syncOfficialLottoDraws();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[POST /api/admin/draws/sync] 동기화 실패", { adminUserId: user.id, error });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "동기화 중 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
