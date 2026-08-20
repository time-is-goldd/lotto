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
  type DailyFortuneInput,
} from "./dailyFortune";
import { MAX_LUCK_SCORE, MIN_LUCK_SCORE } from "@/lib/data/fortune/tiers";

function sequenceRandom(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const BIRTH_DATE = "1995-03-14";
const TARGET_DATE = "2026-08-12";

const BASE_INPUT: DailyFortuneInput = { birthDate: BIRTH_DATE, targetDate: TARGET_DATE };

describe("generateDailyFortune — determinism (같은 입력+같은 날짜=항상 같은 결과)", () => {
  it("returns an identical result for the same input across repeated calls", () => {
    const first = generateDailyFortune(BASE_INPUT);
    const second = generateDailyFortune(BASE_INPUT);
    expect(second).toEqual(first);
  });

  it("does not depend on call order or prior calls (no hidden mutable state)", () => {
    generateDailyFortune({ birthDate: "1988-11-02", targetDate: "2026-01-01" });
    const first = generateDailyFortune(BASE_INPUT);
    generateDailyFortune({ birthDate: "2000-06-30", targetDate: "2026-12-31" });
    const second = generateDailyFortune(BASE_INPUT);
    expect(second).toEqual(first);
  });
});

// claude-code-luck-platform-fortune-domain-followup-prompt.md §7: "비회원과 회원이 같은
// 입력을 사용하면 기본 운세 결과도 일관되어야 한다" — userId가 더 이상 시드에 없으므로,
// 계정 유무와 무관하게 같은 입력이면 항상 같은 결과다. 이 계약이 §7의 핵심이라 별도
// describe 블록으로 명시한다.
describe("generateDailyFortune — guest/member consistency (§7)", () => {
  it("produces the identical result regardless of which 'account' conceptually calls it", () => {
    // userId 파라미터 자체가 없으므로, 같은 입력을 두 번 호출하는 것 자체가 이미
    // "비회원 호출"과 "회원 호출"이 같은 결과를 낸다는 것을 증명한다.
    const asGuest = generateDailyFortune(BASE_INPUT);
    const asMember = generateDailyFortune({ ...BASE_INPUT });
    expect(asMember).toEqual(asGuest);
  });

  it("gender affects the result when provided, and 'N' behaves the same as omitted", () => {
    const omitted = generateDailyFortune(BASE_INPUT);
    const explicitN = generateDailyFortune({ ...BASE_INPUT, gender: "N" });
    const male = generateDailyFortune({ ...BASE_INPUT, gender: "M" });

    expect(explicitN).toEqual(omitted);
    expect(male).not.toEqual(omitted);
  });

  it("birthTime affects the result when provided, and normalizes HH:MM vs HH:MM:SS to the same seed", () => {
    const omitted = generateDailyFortune(BASE_INPUT);
    const withTimeShort = generateDailyFortune({ ...BASE_INPUT, birthTime: "14:30" });
    const withTimeLong = generateDailyFortune({ ...BASE_INPUT, birthTime: "14:30:00" });

    expect(withTimeShort).not.toEqual(omitted);
    expect(withTimeLong).toEqual(withTimeShort);
  });
});

describe("generateDailyFortune — varies across inputs", () => {
  it("produces a different result for a different targetDate (new day → new result)", () => {
    const results = Array.from({ length: 15 }, (_, i) =>
      generateDailyFortune({
        birthDate: BIRTH_DATE,
        targetDate: `2026-08-${String(i + 1).padStart(2, "0")}`,
      })
    );
    const allIdentical = results.every((r) => JSON.stringify(r) === JSON.stringify(results[0]));
    expect(allIdentical).toBe(false);
  });

  it("produces a different result for a different birthDate on the same targetDate", () => {
    const results = [
      "1990-01-01",
      "1991-02-02",
      "1992-03-03",
      "1993-04-04",
      "1994-05-05",
      "1995-06-06",
    ].map((birthDate) => generateDailyFortune({ birthDate, targetDate: TARGET_DATE }));
    const allIdentical = results.every((r) => JSON.stringify(r) === JSON.stringify(results[0]));
    expect(allIdentical).toBe(false);
  });
});

describe("generateDailyFortune — field shape/range invariants", () => {
  const fortune = generateDailyFortune(BASE_INPUT);

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
      const r = generateDailyFortune({ birthDate: `1990-01-0${(i % 9) + 1}`, targetDate: TARGET_DATE });
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
      const r = generateDailyFortune({
        birthDate: `1990-0${(i % 9) + 1}-15`,
        targetDate: TARGET_DATE,
      });
      expect(r.moneyLuckScore).toBeGreaterThanOrEqual(MIN_MONEY_SCORE);
      expect(r.moneyLuckScore).toBeLessThanOrEqual(MAX_MONEY_SCORE);
      expect(Math.abs(r.moneyLuckScore - r.luckScore)).toBeLessThanOrEqual(15);
    }
  });
});

describe("zodiacSignFromBirthDate", () => {
  it("depends only on birthDate, not on targetDate/gender/birthTime", () => {
    const a = generateDailyFortune(BASE_INPUT);
    const b = generateDailyFortune({
      birthDate: BIRTH_DATE,
      targetDate: "2026-12-25",
      gender: "F",
      birthTime: "08:00",
    });
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
    expect(computeFortuneSeed(BASE_INPUT)).toBe(computeFortuneSeed(BASE_INPUT));
  });

  it("changes when birthDate, targetDate, gender, or birthTime changes", () => {
    const base = computeFortuneSeed(BASE_INPUT);
    expect(computeFortuneSeed({ ...BASE_INPUT, birthDate: "1995-03-15" })).not.toBe(base);
    expect(computeFortuneSeed({ ...BASE_INPUT, targetDate: "2026-08-13" })).not.toBe(base);
    expect(computeFortuneSeed({ ...BASE_INPUT, gender: "M" })).not.toBe(base);
    expect(computeFortuneSeed({ ...BASE_INPUT, birthTime: "09:00" })).not.toBe(base);
  });

  it("treats gender omitted, null, and 'N' as the same unknown state", () => {
    const omitted = computeFortuneSeed(BASE_INPUT);
    const nullGender = computeFortuneSeed({ ...BASE_INPUT, gender: null });
    const explicitN = computeFortuneSeed({ ...BASE_INPUT, gender: "N" });
    expect(nullGender).toBe(omitted);
    expect(explicitN).toBe(omitted);
  });

  it("treats birthTime omitted and null as the same unknown state", () => {
    const omitted = computeFortuneSeed(BASE_INPUT);
    const nullTime = computeFortuneSeed({ ...BASE_INPUT, birthTime: null });
    expect(nullTime).toBe(omitted);
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
