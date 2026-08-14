import { createClient } from "@/lib/supabase/service";
import type { WinRank } from "@/lib/types/winning";

// Phase6-3 계약(docs/PHASE6_ADMIN_DRAW_PROCESSING_REPORT.md). notifications INSERT는
// supabase/migrations/0008_rls_policies.sql에 client 대상 정책이 없다 — service_role
// 전용이다(DATABASE_SCHEMA.md §6 "관리자 정책 공통 원칙"). 이 함수는 관리자 배치
// (lib/api/admin/draws.ts)에서만 호출되며, 일반 사용자 요청 경로에서는 호출되지 않는다.
const WIN_RANK_LABEL: Record<WinRank, string> = {
  1: "1등",
  2: "2등",
  3: "3등",
  4: "4등",
  5: "5등",
};

// link_url: Phase10-4C(당첨확인)가 app/my/journal/results/page.tsx를 전용 결과 화면으로
// 완성했다 — 이 주석이 예고했던 대로 상수만 바꿨다. docs/SITEMAP.md/docs/USER_FLOW.md가
// 이미 "/my/journal/results"를 canonical 당첨확인 경로로 계획해뒀던 것과도 일치한다.
const RESULT_LINK_URL = "/my/journal/results";

// 낙첨(winRank: null)에는 절대 호출하지 않는다 — 호출부(lib/api/admin/draws.ts)가
// winRank !== null인 경우에만 이 함수를 부른다.
export async function createWinNotification(
  userId: string,
  round: number,
  winRank: WinRank
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: "win_result",
    title: `${round}회차 ${WIN_RANK_LABEL[winRank]} 당첨을 축하합니다!`,
    body: `저장하신 번호가 ${round}회차 ${WIN_RANK_LABEL[winRank]}에 당첨되었습니다.`,
    link_url: RESULT_LINK_URL,
  });

  if (error) {
    throw error;
  }
}
