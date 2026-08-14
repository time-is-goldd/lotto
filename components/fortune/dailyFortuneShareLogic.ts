// components/fortune/DailyFortuneCard.tsx가 쓰는 순수 로직만 분리한 파일이다. 이 프로젝트의
// vitest 설정(environment: "node")은 jsdom이 없어 컴포넌트를 렌더링해서 테스트할 수 없다
// (components/generate/generatorSaveLogic.ts와 동일한 이유로 분리) — 여기 있는 함수들은
// React와 무관해 그대로 단위 테스트할 수 있다.

export interface ShareableFortune {
  overallFortune: string;
  luckyColor: string;
  luckyTime: string;
  luckyNumbers: number[];
  recommendedNumbers: number[];
}

// 공유 문구(§23)는 개인정보를 절대 포함하지 않는다 — birth_date/user_id/nickname/email 등은
// 이 함수의 입력에도 등장하지 않는다(ShareableFortune이 그 필드들을 아예 받지 않음). 당첨
// 확률이 올라간다는 식의 표현도 쓰지 않는다(§13/§22).
export function buildShareText(fortune: ShareableFortune, siteUrl: string): string {
  return [
    "오늘의 행운을 확인했어요.",
    fortune.overallFortune,
    `행운의 색: ${fortune.luckyColor} · 행운의 시간: ${fortune.luckyTime}`,
    `행운의 숫자: ${fortune.luckyNumbers.join(", ")}`,
    `오늘의 추천 번호: ${fortune.recommendedNumbers.join(", ")}`,
    "(오락·참고용으로 제공되는 결과예요)",
    siteUrl,
  ].join("\n");
}
