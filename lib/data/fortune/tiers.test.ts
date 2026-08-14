import { describe, expect, it } from "vitest";

import { luckScoreLabel, tierFromLuckScore } from "./tiers";

describe("luckScoreLabel", () => {
  it("labels 90+ as 행운이 가득한 날", () => {
    expect(luckScoreLabel(90)).toBe("행운이 가득한 날");
    expect(luckScoreLabel(100)).toBe("행운이 가득한 날");
  });

  it("labels 75~89 as 좋은 흐름의 날", () => {
    expect(luckScoreLabel(75)).toBe("좋은 흐름의 날");
    expect(luckScoreLabel(89)).toBe("좋은 흐름의 날");
  });

  it("labels 60~74 as 무난한 흐름", () => {
    expect(luckScoreLabel(60)).toBe("무난한 흐름");
    expect(luckScoreLabel(74)).toBe("무난한 흐름");
  });

  it("labels below 60 as 천천히 움직여볼 날", () => {
    expect(luckScoreLabel(59)).toBe("천천히 움직여볼 날");
    expect(luckScoreLabel(0)).toBe("천천히 움직여볼 날");
  });
});

describe("tierFromLuckScore (existing, unchanged behavior)", () => {
  it("still classifies good/neutral/caution the same way", () => {
    expect(tierFromLuckScore(80)).toBe("good");
    expect(tierFromLuckScore(65)).toBe("neutral");
    expect(tierFromLuckScore(55)).toBe("caution");
  });
});
