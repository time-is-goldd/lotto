import { describe, expect, it } from "vitest";

import { WinningValidationError } from "@/lib/logic/matchNumbers";

import { isDrawFormFilled, validateDrawForm, type DrawFormValues } from "./drawFormValidation";

const VALID_VALUES: DrawFormValues = {
  round: "1150",
  numbers: ["3", "7", "12", "21", "34", "45"],
  bonusNumber: "9",
  firstPrizeAmount: "2500000000",
  firstPrizeCount: "10",
};

describe("isDrawFormFilled", () => {
  it("returns true when every field is non-empty", () => {
    expect(isDrawFormFilled(VALID_VALUES)).toBe(true);
  });

  it("returns false when round is empty", () => {
    expect(isDrawFormFilled({ ...VALID_VALUES, round: "" })).toBe(false);
  });

  it("returns false when any winning number is empty", () => {
    const numbers = [...VALID_VALUES.numbers] as DrawFormValues["numbers"];
    numbers[3] = "";
    expect(isDrawFormFilled({ ...VALID_VALUES, numbers })).toBe(false);
  });

  it("returns false when bonusNumber/firstPrizeAmount/firstPrizeCount is empty", () => {
    expect(isDrawFormFilled({ ...VALID_VALUES, bonusNumber: "" })).toBe(false);
    expect(isDrawFormFilled({ ...VALID_VALUES, firstPrizeAmount: "" })).toBe(false);
    expect(isDrawFormFilled({ ...VALID_VALUES, firstPrizeCount: "" })).toBe(false);
  });
});

describe("validateDrawForm", () => {
  it("returns the parsed payload for valid input", () => {
    expect(validateDrawForm(VALID_VALUES)).toEqual({
      round: 1150,
      winningNumbers: [3, 7, 12, 21, 34, 45],
      bonusNumber: 9,
      firstPrizeAmount: 2500000000,
      firstPrizeCount: 10,
    });
  });

  it.each([
    ["round is zero", { ...VALID_VALUES, round: "0" }],
    ["round is negative", { ...VALID_VALUES, round: "-1" }],
    ["round is not an integer", { ...VALID_VALUES, round: "1.5" }],
    ["round is empty", { ...VALID_VALUES, round: "" }],
    ["round is non-numeric", { ...VALID_VALUES, round: "abc" }],
  ])("rejects invalid round: %s", (_label, values) => {
    expect(() => validateDrawForm(values)).toThrow(WinningValidationError);
  });

  it("rejects fewer than 6 winning numbers", () => {
    const values = { ...VALID_VALUES, numbers: ["1", "2", "3", "4", "5", ""] as DrawFormValues["numbers"] };
    expect(() => validateDrawForm(values)).toThrow(WinningValidationError);
  });

  it("rejects a winning number outside 1~45", () => {
    const numbers = ["1", "2", "3", "4", "5", "46"] as DrawFormValues["numbers"];
    expect(() => validateDrawForm({ ...VALID_VALUES, numbers })).toThrow(WinningValidationError);
  });

  it("rejects duplicate winning numbers", () => {
    const numbers = ["1", "2", "3", "4", "5", "5"] as DrawFormValues["numbers"];
    expect(() => validateDrawForm({ ...VALID_VALUES, numbers })).toThrow(WinningValidationError);
  });

  it("rejects a bonus number that duplicates a winning number", () => {
    expect(() => validateDrawForm({ ...VALID_VALUES, bonusNumber: "3" })).toThrow(
      WinningValidationError
    );
  });

  it("rejects a bonus number outside 1~45", () => {
    expect(() => validateDrawForm({ ...VALID_VALUES, bonusNumber: "0" })).toThrow(
      WinningValidationError
    );
  });

  it.each([
    ["firstPrizeAmount is negative", { ...VALID_VALUES, firstPrizeAmount: "-1" }],
    ["firstPrizeAmount is not an integer", { ...VALID_VALUES, firstPrizeAmount: "1.5" }],
    ["firstPrizeCount is negative", { ...VALID_VALUES, firstPrizeCount: "-1" }],
    ["firstPrizeCount is not an integer", { ...VALID_VALUES, firstPrizeCount: "1.5" }],
  ])("rejects: %s", (_label, values) => {
    expect(() => validateDrawForm(values)).toThrow(WinningValidationError);
  });

  it("accepts firstPrizeAmount/firstPrizeCount of exactly 0", () => {
    expect(
      validateDrawForm({ ...VALID_VALUES, firstPrizeAmount: "0", firstPrizeCount: "0" })
    ).toMatchObject({ firstPrizeAmount: 0, firstPrizeCount: 0 });
  });
});
