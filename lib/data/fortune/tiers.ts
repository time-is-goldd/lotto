// 오늘의 행운(Phase10-4A) 콘텐츠 뱅크 공통 타입. 새 fortune_templates DB 테이블을 만들지
// 않고(지시문 §36 명시 금지) 코드 안에 정적 배열로 문구 풀을 둔다 — 이 파일과
// lib/data/fortune/*.ts가 그 "테이블 대신"의 위치다.
//
// luck_score(기존 fortune_results.luck_score, smallint not null 재사용)를 3단계로만
// 나눠 금전운/행동지침/피할행동/총평 문구를 고른다(지시문 §9 "복잡한 사주/점성술 엔진을
// 만들지 않는다" — 규칙은 이 3단계 분기 하나뿐이다). caution도 "나쁜 하루"가 아니라
// "조금 더 신중하게"에 가까운 톤을 유지해 §8의 "가볍고 긍정적인 톤" 원칙을 지킨다.
export type FortuneTier = "good" | "neutral" | "caution";

export const MIN_LUCK_SCORE = 55;
export const MAX_LUCK_SCORE = 92;

export function tierFromLuckScore(luckScore: number): FortuneTier {
  if (luckScore >= 75) {
    return "good";
  }
  if (luckScore >= 60) {
    return "neutral";
  }
  return "caution";
}

// UX Polish Task §8: 숫자만 보여주기보다 짧은 해석 문구를 함께 보여준다. tierFromLuckScore()
// (콘텐츠 뱅크 선택용 3단계)와는 별개의, 화면 표시 전용 4단계 라벨이다 — 실제 luckScore
// 범위(MIN_LUCK_SCORE~MAX_LUCK_SCORE = 55~92)를 기준으로 4개 구간 모두 실제로 나올 수
// 있다. 과장된 미래 예측 표현은 쓰지 않는다(§8 "과장된 미래 예측 표현은 피한다").
export function luckScoreLabel(luckScore: number): string {
  if (luckScore >= 90) {
    return "행운이 가득한 날";
  }
  if (luckScore >= 75) {
    return "좋은 흐름의 날";
  }
  if (luckScore >= 60) {
    return "무난한 흐름";
  }
  return "천천히 움직여볼 날";
}
