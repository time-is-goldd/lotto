import { NextResponse } from "next/server";

import { syncOfficialLottoDraws } from "@/lib/api/admin/lottoSync";

// Phase10-6 계약(docs/OFFICIAL_LOTTO_AUTO_SYNC_REPORT.md §16~§19). Vercel의 공식 Cron 보호
// 방식을 그대로 따른다 — Vercel이 vercel.json에 등록된 Cron을 실행할 때 자동으로
// `Authorization: Bearer ${CRON_SECRET}` 헤더를 붙인다(Vercel 공식 문서 컨벤션). 이 값이
// 정확히 일치하지 않으면(환경변수가 아예 설정되지 않은 경우 포함) 401로 거부하고 DB에는
// 아무 영향도 주지 않는다 — sync 서비스 호출 자체를 시작하지 않는다.
function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

// GET /api/cron/sync-lotto — Vercel Cron 전용 트리거. 이 라우트는 그 자체로는 "언제 어떤
// 회차를 시도할지"를 전혀 판단하지 않는다 — 그 판단(latest round 계산, 누락 회차 복구,
// 충돌 감지, idempotency)은 전부 syncOfficialLottoDraws()(lib/api/admin/lottoSync.ts)의
// 책임이다. 관리자 수동 동기화(app/api/admin/draws/sync/route.ts)도 정확히 같은 함수를
// 호출한다 — Cron과 Admin이 서로 다른 로직을 갖지 않는다(지시문 §21).
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    const result = await syncOfficialLottoDraws();
    // 민감한 사용자 데이터(user_numbers, 알림 대상 등)는 반환하지 않는다 — 운영 확인용
    // 요약(회차/상태/메시지)만 응답한다(지시문 §19).
    return NextResponse.json({
      status: result.status,
      rounds: result.syncedRounds,
      conflictRound: result.conflictRound,
      message: result.message,
    });
  } catch (error) {
    console.error("[GET /api/cron/sync-lotto] 동기화 중 예상치 못한 오류", { error });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "동기화 중 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
