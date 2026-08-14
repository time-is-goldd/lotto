import { describe, expect, it } from "vitest";

import { getMatchedNumbers, getResultDisplayStatus, isBonusMatch } from "./winningDisplay";

describe("getResultDisplayStatus", () => {
  it("returns pending when checked_at is null (NULL target_round, not yet matched)", () => {
    expect(getResultDisplayStatus({ checked_at: null, win_rank: null })).toBe("pending");
  });

  it("returns lost when checked but win_rank is null", () => {
    expect(getResultDisplayStatus({ checked_at: "2026-08-12T00:00:00Z", win_rank: null })).toBe(
      "lost"
    );
  });

  it.each([1, 2, 3, 4, 5])("returns won for every real rank (%s등)", (winRank) => {
    expect(getResultDisplayStatus({ checked_at: "2026-08-12T00:00:00Z", win_rank: winRank })).toBe(
      "won"
    );
  });
});

describe("getMatchedNumbers", () => {
  it("returns only the user numbers that appear in the winning numbers", () => {
    const userNumbers = [4, 11, 19, 24, 31, 42];
    const winningNumbers = [1, 11, 19, 24, 40, 45];

    expect(getMatchedNumbers(userNumbers, winningNumbers)).toEqual([11, 19, 24]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(getMatchedNumbers([1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12])).toEqual([]);
  });

  it("returns all 6 when every number matches (1st place)", () => {
    const numbers = [1, 14, 16, 34, 41, 44];
    expect(getMatchedNumbers(numbers, numbers)).toEqual(numbers);
  });

  it("preserves the user's own number order (not the winning-number order)", () => {
    expect(getMatchedNumbers([42, 4, 24], [4, 24, 42])).toEqual([42, 4, 24]);
  });
});

describe("isBonusMatch", () => {
  it("returns true when the user's numbers include the bonus number", () => {
    expect(isBonusMatch([4, 11, 13, 24, 31, 42], 13)).toBe(true);
  });

  it("returns false when the user's numbers do not include the bonus number", () => {
    expect(isBonusMatch([4, 11, 19, 24, 31, 42], 13)).toBe(false);
  });
});
