import { describe, expect, it } from "vitest";

import {
  comboOrdinalLabel,
  dailyProgressLabel,
  isDailyLimitReached,
  MAX_DAILY_GENERATIONS,
  nextGenerateCtaLabel,
  remainingDailyGenerations,
} from "./dailyNumberPolicy";

describe("MAX_DAILY_GENERATIONS", () => {
  it("is exactly 3 (claude-code-luck-platform-home-brand-daily-numbers-prompt.md §9.1)", () => {
    expect(MAX_DAILY_GENERATIONS).toBe(3);
  });
});

describe("comboOrdinalLabel", () => {
  it("returns 첫/두/세 번째 조합 for slots 1-3", () => {
    expect(comboOrdinalLabel(1)).toBe("첫 번째 조합");
    expect(comboOrdinalLabel(2)).toBe("두 번째 조합");
    expect(comboOrdinalLabel(3)).toBe("세 번째 조합");
  });

  it("falls back to a numeric label for out-of-range slots", () => {
    expect(comboOrdinalLabel(4)).toBe("4번째 조합");
  });
});

describe("remainingDailyGenerations", () => {
  it("counts down from 3 to 0", () => {
    expect(remainingDailyGenerations(0)).toBe(3);
    expect(remainingDailyGenerations(1)).toBe(2);
    expect(remainingDailyGenerations(2)).toBe(1);
    expect(remainingDailyGenerations(3)).toBe(0);
  });

  it("never goes negative even if comboCount exceeds the max", () => {
    expect(remainingDailyGenerations(5)).toBe(0);
  });
});

describe("isDailyLimitReached", () => {
  it("is false below 3 and true at/above 3", () => {
    expect(isDailyLimitReached(0)).toBe(false);
    expect(isDailyLimitReached(2)).toBe(false);
    expect(isDailyLimitReached(3)).toBe(true);
    expect(isDailyLimitReached(4)).toBe(true);
  });
});

describe("nextGenerateCtaLabel", () => {
  it("returns the exact CTA copy for each 0/1/2-combo state (§9.2)", () => {
    expect(nextGenerateCtaLabel(0)).toBe("첫 조합 만들기");
    expect(nextGenerateCtaLabel(1)).toBe("두 번째 조합 만들기 · 2개 남음");
    expect(nextGenerateCtaLabel(2)).toBe("마지막 조합 만들기 · 1개 남음");
  });

  it("returns null once the daily limit is reached (no generate CTA)", () => {
    expect(nextGenerateCtaLabel(3)).toBeNull();
  });
});

describe("dailyProgressLabel", () => {
  it("formats 오늘 N/3", () => {
    expect(dailyProgressLabel(0)).toBe("오늘 0/3");
    expect(dailyProgressLabel(1)).toBe("오늘 1/3");
    expect(dailyProgressLabel(3)).toBe("오늘 3/3");
  });

  it("clamps a count above the max to 3/3", () => {
    expect(dailyProgressLabel(4)).toBe("오늘 3/3");
  });
});
