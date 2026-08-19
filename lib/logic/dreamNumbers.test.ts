import { describe, expect, it } from "vitest";

import { buildDreamAwareNumbers, inheritParentNumbers } from "./dreamNumbers";
import { MAX_NUMBER, MIN_NUMBER, NUMBERS_PER_GAME } from "./generateNumbers";

function expectValidGame(numbers: number[]) {
  expect(numbers).toHaveLength(NUMBERS_PER_GAME);
  expect(new Set(numbers).size).toBe(NUMBERS_PER_GAME);
  for (const n of numbers) {
    expect(n).toBeGreaterThanOrEqual(MIN_NUMBER);
    expect(n).toBeLessThanOrEqual(MAX_NUMBER);
  }
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
}

describe("buildDreamAwareNumbers", () => {
  it("falls back to pure random when there are no dream numbers", () => {
    const result = buildDreamAwareNumbers(null);
    expectValidGame(result.numbers);
    expect(result.dreamNumbers).toEqual([]);
  });

  it("falls back to pure random for an empty array", () => {
    const result = buildDreamAwareNumbers([]);
    expectValidGame(result.numbers);
    expect(result.dreamNumbers).toEqual([]);
  });

  it("keeps a 1-number dream set fixed and fills the rest randomly", () => {
    const result = buildDreamAwareNumbers([7]);
    expectValidGame(result.numbers);
    expect(result.dreamNumbers).toEqual([7]);
    expect(result.numbers).toContain(7);
  });

  it("keeps a 3-number dream set fixed and fills the rest randomly", () => {
    const result = buildDreamAwareNumbers([3, 11, 40]);
    expectValidGame(result.numbers);
    expect(result.dreamNumbers).toEqual([3, 11, 40]);
    expect(result.numbers).toEqual(expect.arrayContaining([3, 11, 40]));
  });

  it("uses a full 6-number dream set as-is without random fill", () => {
    const dream = [3, 11, 19, 28, 34, 42];
    const result = buildDreamAwareNumbers(dream);
    expect(result.numbers).toEqual(dream);
    expect(result.dreamNumbers).toEqual(dream);
  });

  it("drops out-of-range or duplicate values before using them", () => {
    const result = buildDreamAwareNumbers([5, 5, 0, 46, 12]);
    expect(result.dreamNumbers).toEqual([5, 12]);
    expect(result.numbers).toEqual(expect.arrayContaining([5, 12]));
    expectValidGame(result.numbers);
  });

  it("caps an oversized dream set at 6 numbers", () => {
    const result = buildDreamAwareNumbers([1, 2, 3, 4, 5, 6, 7]);
    expect(result.dreamNumbers).toHaveLength(6);
    expect(result.numbers).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("inheritParentNumbers", () => {
  it("caps inherited parent numbers at 3", () => {
    expect(inheritParentNumbers([2, 16, 23, 31, 40])).toEqual([2, 16, 23]);
  });

  it("returns an empty array when the parent has no numbers", () => {
    expect(inheritParentNumbers(null)).toEqual([]);
  });

  it("passes through a parent set already at or under 3", () => {
    expect(inheritParentNumbers([9, 17])).toEqual([9, 17]);
  });
});
