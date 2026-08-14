import { describe, expect, it } from "vitest";

import {
  LOTTO_MAX,
  LOTTO_MIN,
  MAX_MONEY_SCORE,
  MIN_MONEY_SCORE,
  computeFortuneSeed,
  computeLuckScore,
  computeMoneyLuckScore,
  generateDailyFortune,
  generateSeededNumbers,
  zodiacSignFromBirthDate,
} from "./dailyFortune";
import { MAX_LUCK_SCORE, MIN_LUCK_SCORE } from "@/lib/data/fortune/tiers";

function sequenceRandom(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const BIRTH_DATE = "1995-03-14";
const RESULT_DATE = "2026-08-12";

describe("generateDailyFortune — determinism (같은 사용자+같은 날짜=항상 같은 결과)", () => {
  it("returns an identical result for the same (userId, birthDate, resultDate) across repeated calls", () => {
    const first = generateDailyFortune(USER_A, BIRTH_DATE, RESULT_DATE);
    const second = generateDailyFortune(USER_A, BIRTH_DATE, RESULT_DATE);
    expect(second).toEqual(first);
  });

  it("does not depend on call order or prior calls (no hidden mutable state)", () => {
    generateDailyFortune(USER_B, "1988-11-02", "2026-01-01");
    const first = generateDailyFortune(USER_A, BIRTH_DATE, RESULT_DATE);
    generateDailyFortune(USER_B, "2000-06-30", "2026-12-31");
    const second = generateDailyFortune(USER_A, BIRTH_DATE, RESULT_DATE);
    expect(second).toEqual(first);
  });
});

describe("generateDailyFortune — varies across users/dates", () => {
  it("produces a different result for a different resultDate (new day → new result)", () => {
    const results = Array.from({ length: 15 }, (_, i) =>
      generateDailyFortune(USER_A, BIRTH_DATE, `2026-08-${String(i + 1).padStart(2, "0")}`)
    );
    const allIdentical = results.every((r) => JSON.stringify(r) === JSON.stringify(results[0]));
    expect(allIdentical).toBe(false);
  });

  it("produces a different result for a different userId on the same day", () => {
    const results = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"].map((id) =>
      generateDailyFortune(id, BIRTH_DATE, RESULT_DATE)
    );
    const allIdentical = results.every((r) => JSON.stringify(r) === JSON.stringify(results[0]));
    expect(allIdentical).toBe(false);
  });
});

describe("generateDailyFortune — field shape/range invariants", () => {
  const fortune = generateDailyFortune(USER_A, BIRTH_DATE, RESULT_DATE);

  it("recommendedNumbers has exactly 6 unique ascending numbers within 1..45", () => {
    expect(fortune.recommendedNumbers).toHaveLength(6);
    expect(new Set(fortune.recommendedNumbers).size).toBe(6);
    for (const n of fortune.recommendedNumbers) {
      expect(n).toBeGreaterThanOrEqual(LOTTO_MIN);
      expect(n).toBeLessThanOrEqual(LOTTO_MAX);
    }
    const sorted = [...fortune.recommendedNumbers].sort((a, b) => a - b);
    expect(fortune.recommendedNumbers).toEqual(sorted);
  });

  it("luckyNumbers has 1~3 unique numbers within 1..45", () => {
    expect(fortune.luckyNumbers.length).toBeGreaterThanOrEqual(1);
    expect(fortune.luckyNumbers.length).toBeLessThanOrEqual(3);
    expect(new Set(fortune.luckyNumbers).size).toBe(fortune.luckyNumbers.length);
    for (const n of fortune.luckyNumbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(45);
    }
  });

  it("luckScore stays within the configured MIN..MAX range", () => {
    for (let i = 0; i < 30; i++) {
      const r = generateDailyFortune(`user-${i}`, BIRTH_DATE, RESULT_DATE);
      expect(r.luckScore).toBeGreaterThanOrEqual(MIN_LUCK_SCORE);
      expect(r.luckScore).toBeLessThanOrEqual(MAX_LUCK_SCORE);
    }
  });

  it("all text fields are non-empty strings", () => {
    expect(fortune.overallFortune.length).toBeGreaterThan(0);
    expect(fortune.moneyLuck.length).toBeGreaterThan(0);
    expect(fortune.actionGuide.length).toBeGreaterThan(0);
    expect(fortune.thingsToAvoid.length).toBeGreaterThan(0);
    expect(fortune.luckyColor.length).toBeGreaterThan(0);
    expect(fortune.luckyTime.length).toBeGreaterThan(0);
  });

  it("lucky_color/lucky_time stay within the varchar(20) column limit", () => {
    expect(fortune.luckyColor.length).toBeLessThanOrEqual(20);
    expect(fortune.luckyTime.length).toBeLessThanOrEqual(20);
  });

  it("moneyLuckScore stays within MIN_MONEY_SCORE..MAX_MONEY_SCORE and never strays more than 15 from luckScore", () => {
    for (let i = 0; i < 30; i++) {
      const r = generateDailyFortune(`money-user-${i}`, BIRTH_DATE, RESULT_DATE);
      expect(r.moneyLuckScore).toBeGreaterThanOrEqual(MIN_MONEY_SCORE);
      expect(r.moneyLuckScore).toBeLessThanOrEqual(MAX_MONEY_SCORE);
      expect(Math.abs(r.moneyLuckScore - r.luckScore)).toBeLessThanOrEqual(15);
    }
  });
});

describe("zodiacSignFromBirthDate", () => {
  it("depends only on birthDate, not on userId or resultDate", () => {
    const a = generateDailyFortune(USER_A, BIRTH_DATE, RESULT_DATE);
    const b = generateDailyFortune(USER_B, BIRTH_DATE, "2026-12-25");
    expect(a.zodiacSign).toBe(b.zodiacSign);
  });

  it("computes known boundary dates correctly", () => {
    expect(zodiacSignFromBirthDate("1995-03-14")).toBe("물고기자리");
    expect(zodiacSignFromBirthDate("1995-03-21")).toBe("양자리");
    expect(zodiacSignFromBirthDate("2000-01-01")).toBe("염소자리");
    expect(zodiacSignFromBirthDate("2000-12-31")).toBe("염소자리");
    expect(zodiacSignFromBirthDate("2000-07-23")).toBe("사자자리");
  });
});

// UX Polish Task §6: "별자리 날짜 경계도 단위 테스트한다" — 12개 별자리 전부의 시작/끝 경계를
// 빠짐없이 검증한다(염소자리는 연초/연말 두 구간에 걸쳐 있어 총 24개 지점).
describe("zodiacSignFromBirthDate — full 12-sign boundary sweep", () => {
  const boundaries: Array<[string, string]> = [
    ["1995-01-19", "염소자리"],
    ["1995-01-20", "물병자리"],
    ["1995-02-18", "물병자리"],
    ["1995-02-19", "물고기자리"],
    ["1995-03-20", "물고기자리"],
    ["1995-03-21", "양자리"],
    ["1995-04-19", "양자리"],
    ["1995-04-20", "황소자리"],
    ["1995-05-20", "황소자리"],
    ["1995-05-21", "쌍둥이자리"],
    ["1995-06-21", "쌍둥이자리"],
    ["1995-06-22", "게자리"],
    ["1995-07-22", "게자리"],
    ["1995-07-23", "사자자리"],
    ["1995-08-22", "사자자리"],
    ["1995-08-23", "처녀자리"],
    ["1995-09-22", "처녀자리"],
    ["1995-09-23", "천칭자리"],
    ["1995-10-23", "천칭자리"],
    ["1995-10-24", "전갈자리"],
    ["1995-11-22", "전갈자리"],
    ["1995-11-23", "사수자리"],
    ["1995-12-21", "사수자리"],
    ["1995-12-22", "염소자리"],
  ];

  it.each(boundaries)("%s → %s", (date, expectedSign) => {
    expect(zodiacSignFromBirthDate(date)).toBe(expectedSign);
  });

  it("covers all 12 zodiac signs across the boundary sweep", () => {
    const allSigns = new Set(boundaries.map(([, sign]) => sign));
    expect(allSigns.size).toBe(12);
  });
});

describe("computeFortuneSeed", () => {
  it("is deterministic for identical inputs", () => {
    expect(computeFortuneSeed(USER_A, BIRTH_DATE, RESULT_DATE)).toBe(
      computeFortuneSeed(USER_A, BIRTH_DATE, RESULT_DATE)
    );
  });

  it("changes when any single input changes", () => {
    const base = computeFortuneSeed(USER_A, BIRTH_DATE, RESULT_DATE);
    expect(computeFortuneSeed(USER_B, BIRTH_DATE, RESULT_DATE)).not.toBe(base);
    expect(computeFortuneSeed(USER_A, "1995-03-15", RESULT_DATE)).not.toBe(base);
    expect(computeFortuneSeed(USER_A, BIRTH_DATE, "2026-08-13")).not.toBe(base);
  });
});

describe("generateSeededNumbers", () => {
  it("returns the same numbers for the same seed", () => {
    expect(generateSeededNumbers(42)).toEqual(generateSeededNumbers(42));
  });

  it("returns 6 unique ascending numbers within 1..45 by default", () => {
    const numbers = generateSeededNumbers(999);
    expect(numbers).toHaveLength(6);
    expect(new Set(numbers).size).toBe(6);
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(45);
    }
  });

  it("respects a custom count", () => {
    expect(generateSeededNumbers(7, 2)).toHaveLength(2);
    expect(generateSeededNumbers(7, 3)).toHaveLength(3);
  });

  it("is fully independent from Math.random (never throws, never NaN across many seeds)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const numbers = generateSeededNumbers(seed);
      expect(numbers.every((n) => Number.isInteger(n))).toBe(true);
    }
  });
});

describe("computeLuckScore", () => {
  it("stays within MIN_LUCK_SCORE..MAX_LUCK_SCORE for the full random range", () => {
    expect(computeLuckScore(() => 0)).toBe(MIN_LUCK_SCORE);
    expect(computeLuckScore(() => 0.999999)).toBe(MAX_LUCK_SCORE);
  });
});

describe("computeMoneyLuckScore", () => {
  it("is deterministic for the same overallScore and random sequence", () => {
    const overall = 78;
    const a = computeMoneyLuckScore(overall, sequenceRandom([0.3, 0.7]));
    const b = computeMoneyLuckScore(overall, sequenceRandom([0.3, 0.7]));
    expect(a).toBe(b);
  });

  it("never returns exactly the overall score (deviation excludes 0)", () => {
    // magnitude = 1 + floor(r1*15) ∈ [1,15] — r1=0이어도 최소 편차 1
    expect(computeMoneyLuckScore(78, sequenceRandom([0, 0.9]))).toBe(79); // +1
    expect(computeMoneyLuckScore(78, sequenceRandom([0, 0.1]))).toBe(77); // -1
    expect(computeMoneyLuckScore(78, sequenceRandom([0.999999, 0.9]))).toBe(93); // +15
    expect(computeMoneyLuckScore(78, sequenceRandom([0.999999, 0.1]))).toBe(63); // -15
  });

  it("clamps to MAX_MONEY_SCORE without ever exceeding a 15-point deviation from overall", () => {
    const score = computeMoneyLuckScore(MAX_LUCK_SCORE, sequenceRandom([0.999999, 0.9])); // 92+15=107
    expect(score).toBe(MAX_MONEY_SCORE);
    expect(Math.abs(score - MAX_LUCK_SCORE)).toBeLessThanOrEqual(15);
  });

  it("clamps to MIN_MONEY_SCORE without ever exceeding a 15-point deviation from overall", () => {
    const score = computeMoneyLuckScore(MIN_LUCK_SCORE, sequenceRandom([0.999999, 0.1])); // 55-15=40
    expect(score).toBe(MIN_MONEY_SCORE);
    expect(Math.abs(score - MIN_LUCK_SCORE)).toBeLessThanOrEqual(15);
  });
});
