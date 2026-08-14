// Phase6-1 계약(docs/PHASE6_WINNING_LOGIC_REPORT.md). docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md
// §2/§5/§11이 이미 정리한 "판정에 필요한 데이터"와 "표시를 위한 부가 데이터"의 분리를
// 타입으로 그대로 반영한다. 이번 Task는 DB에 없는 컬럼을 새로 전제하지 않는다 — 아래 두
// 타입의 필드는 전부 실제 supabase/migrations/0002_draws_user_numbers.sql의 draws 컬럼과
// 1:1로 대응한다(추측으로 만든 필드 없음).

// 당첨 판정(matchNumbers)에 필요한 최소 데이터. draws.round/numbers/bonus_number
// (0002_draws_user_numbers.sql)와 대응한다 — 관리자가 회차 결과를 입력하면 이 형태로
// 조립된다고 가정한다(입력 화면 자체는 Phase9 범위, 이번 Task에서 만들지 않음).
export interface WinningDraw {
  round: number;
  winningNumbers: number[];
  bonusNumber: number;
}

// 표시(UI)에만 필요하고 당첨 판정 로직은 전혀 사용하지 않는 부가 데이터.
// draws.first_prize_amount/first_prize_count(0002, 둘 다 1등 전용 컬럼)와 대응한다.
// docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md §5/§14-12가 이미 확인한 대로 2~5등 당첨금
// 컬럼과 추첨일(draw_date, §14-13) 컬럼은 현재 스키마에 없어 이 타입에 넣지 않았다 —
// 나중에 Migration으로 추가되면 그때 확장한다(지금 존재하지 않는 컬럼을 가정하지 않음).
export interface WinningDrawPrizeInfo {
  firstPrizeAmount: number;
  firstPrizeCount: number;
}

// "6등"은 로또 6/45 공식 등수 체계에 존재하지 않는다(docs/PHASE6_PRE_IMPLEMENTATION_AUDIT.md
// §5 "용어 정정") — 1~5등만 실제 등수이고 그 외는 전부 낙첨이다.
export type WinRank = 1 | 2 | 3 | 4 | 5;

// matchNumbers()의 반환 타입. winRank가 null이면 낙첨이다("미확인"과는 다른 개념 —
// docs/PHASE6_WINNING_LOGIC_REPORT.md §8 참조. 이 타입 자체에는 "미확인" 상태를 넣지
// 않았다: matchNumbers()는 항상 실제 당첨번호가 있을 때만 호출되고, "아직 대조 안 함"은
// 이 함수를 아예 호출하지 않는 것으로 표현되는 상위 레이어의 책임이다).
export interface MatchResult {
  matchCount: number; // 0~6, 사용자 번호 중 당첨번호와 일치하는 개수
  bonusMatched: boolean; // 사용자 번호에 보너스 번호가 포함되는지
  winRank: WinRank | null; // null = 낙첨
}
