import { describe, expect, it } from "vitest";

import { assertValidPartialNumberSet, matchNumbers, WinningValidationError } from "./matchNumbers";

const WINNING = [1, 2, 3, 4, 5, 6];
const BONUS = 7;

describe("matchNumbers", () => {
  it("6개 일치 → 1등", () => {
    const result = matchNumbers([1, 2, 3, 4, 5, 6], WINNING, BONUS);
    expect(result).toEqual({ matchCount: 6, bonusMatched: false, winRank: 1 });
  });

  it("5개 일치 + 보너스 일치 → 2등", () => {
    const result = matchNumbers([1, 2, 3, 4, 5, 7], WINNING, BONUS);
    expect(result).toEqual({ matchCount: 5, bonusMatched: true, winRank: 2 });
  });

  it("5개 일치 + 보너스 불일치 → 3등", () => {
    const result = matchNumbers([1, 2, 3, 4, 5, 8], WINNING, BONUS);
    expect(result).toEqual({ matchCount: 5, bonusMatched: false, winRank: 3 });
  });

  it("4개 일치 → 4등", () => {
    const result = matchNumbers([1, 2, 3, 4, 8, 9], WINNING, BONUS);
    expect(result).toEqual({ matchCount: 4, bonusMatched: false, winRank: 4 });
  });

  it("3개 일치 → 5등", () => {
    const result = matchNumbers([1, 2, 3, 8, 9, 10], WINNING, BONUS);
    expect(result).toEqual({ matchCount: 3, bonusMatched: false, winRank: 5 });
  });

  it("2개 일치 → 낙첨", () => {
    const result = matchNumbers([1, 2, 8, 9, 10, 11], WINNING, BONUS);
    expect(result).toEqual({ matchCount: 2, bonusMatched: false, winRank: null });
  });

  it("0개 일치 → 낙첨", () => {
    const result = matchNumbers([10, 11, 12, 13, 14, 15], WINNING, BONUS);
    expect(result).toEqual({ matchCount: 0, bonusMatched: false, winRank: null });
  });

  it("winningNumbers가 정렬되어 있지 않아도 정확히 판정한다", () => {
    const unsorted = [45, 3, 21, 7, 12, 30];
    const result = matchNumbers([3, 7, 12, 21, 30, 45], unsorted, 1);
    expect(result).toEqual({ matchCount: 6, bonusMatched: false, winRank: 1 });
  });

  it("bonusNumber가 사용자 번호에 포함되면 bonusMatched: true", () => {
    const result = matchNumbers([1, 2, 3, 4, 5, 7], WINNING, 7);
    expect(result.bonusMatched).toBe(true);
  });

  it("bonusNumber가 사용자 번호에 없으면 bonusMatched: false", () => {
    const result = matchNumbers([1, 2, 3, 4, 5, 8], WINNING, 7);
    expect(result.bonusMatched).toBe(false);
  });

  it.each([
    ["userNumbers가 유효하지 않음 (5개)", [1, 2, 3, 4, 5], WINNING, BONUS],
    ["winningNumbers가 유효하지 않음 (7개)", [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6, 7], BONUS],
    ["bonusNumber가 winningNumbers와 중복", [1, 2, 3, 4, 5, 6], WINNING, 1],
    ["userNumbers에 중복된 값", [1, 1, 2, 3, 4, 5], WINNING, BONUS],
    ["winningNumbers에 중복된 값", [1, 2, 3, 4, 5, 6], [1, 1, 2, 3, 4, 5], BONUS],
    ["userNumbers에 범위 밖 값 (0)", [0, 1, 2, 3, 4, 5], WINNING, BONUS],
    ["userNumbers에 범위 밖 값 (46)", [1, 2, 3, 4, 5, 46], WINNING, BONUS],
    ["bonusNumber가 범위 밖 값 (46)", [1, 2, 3, 4, 5, 6], WINNING, 46],
    ["userNumbers에 정수가 아닌 값", [1, 2, 3, 4, 5, 5.5], WINNING, BONUS],
    ["bonusNumber가 정수가 아닌 값", [1, 2, 3, 4, 5, 6], WINNING, 7.5],
  ])("%s → WinningValidationError", (_label, userNumbers, winningNumbers, bonusNumber) => {
    expect(() => matchNumbers(userNumbers, winningNumbers, bonusNumber)).toThrow(
      WinningValidationError
    );
  });
});

// dream_situations.numbers(0018_dream_situations.sql) 검증 — 0~6개까지 허용한다는 점만
// assertValidNumberSet(정확히 6개)과 다르고 나머지 규칙(정수/범위/중복 금지)은 동일하다.
describe("assertValidPartialNumberSet", () => {
  it.each([
    ["0개(빈 배열)", []],
    ["1개", [7]],
    ["6개", [1, 2, 3, 4, 5, 6]],
  ])("%s는 통과한다", (_label, numbers) => {
    expect(() => assertValidPartialNumberSet(numbers, "numbers")).not.toThrow();
  });

  it.each([
    ["7개(최대 초과)", [1, 2, 3, 4, 5, 6, 7]],
    ["범위 밖 값(0)", [0, 1]],
    ["범위 밖 값(46)", [45, 46]],
    ["중복된 값", [5, 5]],
    ["정수가 아닌 값", [1, 2.5]],
    ["배열이 아님", "3,17"],
  ])("%s → WinningValidationError", (_label, numbers) => {
    expect(() => assertValidPartialNumberSet(numbers, "numbers")).toThrow(WinningValidationError);
  });
});
