import { getTrustedDrawResult, type TrustedDrawResult } from "@/lib/lotto/sources";
import { createClient as createServiceClient } from "@/lib/supabase/service";

// Phase10-6B 계약(지시문 §22/§23) — "출처 상태 확인" 기능. DB mutation이 0이어야 한다는
// 요구를 코드 구조로 보장한다: 이 파일은 `registerDrawAndMatchUserNumbers`를 아예 import하지
// 않는다 — import조차 하지 않으므로 실수로 호출할 방법 자체가 없다. `draws` 테이블도
// **읽기 전용**으로만 쓴다(다음 회차 번호를 판단하기 위한 SELECT 하나뿐, INSERT/UPDATE/
// DELETE 없음).
//
// lib/api/admin/lottoSync.ts의 자동 동기화 루프와 다른 점: 이 함수는 "다음 회차 하나"만
// 확인하고 끝난다 — 여러 회차를 순회하며 등록하는 backfill 로직이 전혀 없다(그 자체가 이미
// mutation을 전제로 한 개념이라 dry-run 성격과 맞지 않는다).

export interface LottoSourceHealthReport {
  round: number;
  result: TrustedDrawResult;
}

export async function checkLottoSourceHealth(): Promise<LottoSourceHealthReport> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("draws")
    .select("round")
    .order("round", { ascending: false })
    .limit(1);
  if (error) {
    throw error;
  }
  const latestRound = data?.[0]?.round ?? 0;
  const round = latestRound + 1;

  const result = await getTrustedDrawResult(round);

  return { round, result };
}
