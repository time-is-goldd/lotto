import { describe, expect, it } from "vitest";

import { buildShareText, type ShareableFortune } from "./dailyFortuneShareLogic";

const FORTUNE: ShareableFortune = {
  overallFortune: "전반적으로 마음이 가벼워지는 하루가 될 거예요.",
  luckyColor: "코랄",
  luckyTime: "오후 3시~5시",
  luckyNumbers: [7, 21],
  recommendedNumbers: [3, 11, 19, 27, 35, 44],
};

describe("buildShareText", () => {
  it("includes the overall fortune, lucky color/time, lucky numbers, and recommended numbers", () => {
    const text = buildShareText(FORTUNE, "https://example.com/fortune");
    expect(text).toContain(FORTUNE.overallFortune);
    expect(text).toContain("코랄");
    expect(text).toContain("오후 3시~5시");
    expect(text).toContain("7, 21");
    expect(text).toContain("3, 11, 19, 27, 35, 44");
    expect(text).toContain("https://example.com/fortune");
  });

  it("never includes personal fields (they don't exist on ShareableFortune)", () => {
    const text = buildShareText(FORTUNE, "https://example.com/fortune");
    expect(Object.keys(FORTUNE)).not.toContain("birthDate");
    expect(Object.keys(FORTUNE)).not.toContain("userId");
    expect(Object.keys(FORTUNE)).not.toContain("nickname");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/); // 생년월일 같은 날짜 패턴 없음
  });

  it("does not use win-probability-boosting language", () => {
    const text = buildShareText(FORTUNE, "https://example.com/fortune");
    expect(text).not.toMatch(/당첨\s*확률/);
  });
});
