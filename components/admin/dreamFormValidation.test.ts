import { describe, expect, it } from "vitest";

import { WinningValidationError } from "@/lib/logic/matchNumbers";

import { validateDreamForm, type DreamFormValues } from "./dreamFormValidation";

const VALID_VALUES: DreamFormValues = {
  keyword: "돼지꿈",
  category: "동물",
  interpretation: "재물운 상승을 의미한다.",
  numbers: null,
};

describe("validateDreamForm", () => {
  it("returns the parsed payload for valid input without numbers", () => {
    expect(validateDreamForm(VALID_VALUES)).toEqual({
      keyword: "돼지꿈",
      category: "동물",
      interpretation: "재물운 상승을 의미한다.",
      numbers: null,
    });
  });

  it("trims keyword/interpretation", () => {
    expect(
      validateDreamForm({ ...VALID_VALUES, keyword: "  돼지꿈  ", interpretation: "  내용  " })
    ).toMatchObject({ keyword: "돼지꿈", interpretation: "내용" });
  });

  it("treats an empty category as null", () => {
    expect(validateDreamForm({ ...VALID_VALUES, category: "" })).toMatchObject({ category: null });
  });

  it("parses numbers when provided", () => {
    expect(
      validateDreamForm({ ...VALID_VALUES, numbers: ["3", "7", "12", "21", "34", "45"] })
    ).toEqual({
      keyword: "돼지꿈",
      category: "동물",
      interpretation: "재물운 상승을 의미한다.",
      numbers: [3, 7, 12, 21, 34, 45],
    });
  });

  it.each([
    ["empty keyword", { ...VALID_VALUES, keyword: "" }],
    ["whitespace-only keyword", { ...VALID_VALUES, keyword: "   " }],
    ["keyword exceeds max length", { ...VALID_VALUES, keyword: "가".repeat(51) }],
    ["empty interpretation", { ...VALID_VALUES, interpretation: "" }],
    ["interpretation exceeds max length", { ...VALID_VALUES, interpretation: "가".repeat(5001) }],
  ])("rejects: %s", (_label, values) => {
    expect(() => validateDreamForm(values)).toThrow(WinningValidationError);
  });

  it("rejects fewer than 6 numbers when numbers is provided", () => {
    const numbers = ["1", "2", "3", "4", "5", ""] as DreamFormValues["numbers"];
    expect(() => validateDreamForm({ ...VALID_VALUES, numbers })).toThrow(WinningValidationError);
  });

  it("rejects a numbers value outside 1~45", () => {
    const numbers = ["1", "2", "3", "4", "5", "46"] as DreamFormValues["numbers"];
    expect(() => validateDreamForm({ ...VALID_VALUES, numbers })).toThrow(WinningValidationError);
  });

  it("rejects duplicate numbers", () => {
    const numbers = ["1", "2", "3", "4", "5", "5"] as DreamFormValues["numbers"];
    expect(() => validateDreamForm({ ...VALID_VALUES, numbers })).toThrow(WinningValidationError);
  });
});
