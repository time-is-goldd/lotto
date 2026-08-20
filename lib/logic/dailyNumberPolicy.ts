// claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9(오늘의 세 조합) 계약을 담은
// 순수 함수 모음이다. React/Supabase/브라우저 API에 의존하지 않아 회원 경로(서버 DB 행 개수)와
// 비회원 경로(localStorage 항목 개수) 양쪽에서 동일하게 재사용한다 — "3개"라는 숫자와 그에
// 따른 문구가 두 곳에 따로 하드코딩되지 않는다.

export const MAX_DAILY_GENERATIONS = 3;

export type DailyComboSource = "general" | "dream";

// §9.4 "첫 번째 조합"/"두 번째 조합"/"세 번째 조합" 결과 행 제목.
const ORDINAL_LABELS = ["첫 번째 조합", "두 번째 조합", "세 번째 조합"] as const;

export function comboOrdinalLabel(slotIndex: number): string {
  return ORDINAL_LABELS[slotIndex - 1] ?? `${slotIndex}번째 조합`;
}

export function remainingDailyGenerations(comboCount: number): number {
  return Math.max(0, MAX_DAILY_GENERATIONS - comboCount);
}

export function isDailyLimitReached(comboCount: number): boolean {
  return comboCount >= MAX_DAILY_GENERATIONS;
}

// §9.2 CTA 상태 — 0/1/2개일 때의 버튼 문구. 3개(한도 도달)면 생성 CTA 자체가 없어야 하므로
// null을 반환한다(호출부가 버튼을 아예 렌더링하지 않는 신호로 쓴다).
export function nextGenerateCtaLabel(comboCount: number): string | null {
  if (comboCount === 0) {
    return "첫 조합 만들기";
  }
  if (comboCount === 1) {
    return "두 번째 조합 만들기 · 2개 남음";
  }
  if (comboCount === 2) {
    return "마지막 조합 만들기 · 1개 남음";
  }
  return null;
}

// §9.1 "오늘 0/3", "오늘 1/3" 진행 상태 문구.
export function dailyProgressLabel(comboCount: number): string {
  return `오늘 ${Math.min(comboCount, MAX_DAILY_GENERATIONS)}/${MAX_DAILY_GENERATIONS}`;
}
