import type { Tables } from "@/lib/types/database";

// docs/PHASE4_ARCHITECTURE_DECISION.md §9(API Contract): 다이어리 조회 전용 서비스가 다루는
// 3개 테이블의 Row 타입을 그대로 재노출한다. user_period_stats는 §5-1 결정에 따라 이번
// Phase 범위가 아니므로(stats/yearly-report 페이지 자체가 EXECUTION_PLAN Phase4 파일 목록에
// 없음) 여기 포함하지 않는다.
export type UserNumberEntry = Tables<"user_numbers">;
export type DreamJournalEntry = Tables<"dream_journal_entries">;
export type FortuneResultEntry = Tables<"fortune_results">;
// Phase10-4C(당첨확인): draws는 user_numbers.target_round가 가리키는 실제 회차 결과다.
export type DrawEntry = Tables<"draws">;

// limit/offset 방식의 최소 pagination — cursor 기반 등 복잡한 방식은 만들지 않는다
// (이번 Task 지시 §4). offset을 생략하면 0(첫 페이지)으로 취급한다.
export interface ListOptions {
  limit?: number;
  offset?: number;
}

// user_numbers 전용 옵션 — "당첨확인" 화면은 checked_at이 채워진(Phase6에서 대조가 끝난)
// 행만 봐야 하므로, 별도 함수를 만드는 대신 히스토리 조회 함수에 필터 옵션 하나만 얹었다
// (조회 대상 테이블과 정렬 기준이 동일해 별도 함수로 분리할 실익이 없음).
export interface UserNumbersListOptions extends ListOptions {
  onlyChecked?: boolean;
}

export interface DiarySummary {
  totalUserNumbersCount: number;
  recentUserNumbers: UserNumberEntry[];
}
