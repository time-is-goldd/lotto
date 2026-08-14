import { describe, expect, it } from "vitest";

import { WinningValidationError } from "@/lib/logic/matchNumbers";

import {
  parseNumbersText,
  validateDreamSituationForm,
  type DreamSituationFormValues,
} from "./dreamSituationFormValidation";

const VALID_VALUES: DreamSituationFormValues = {
  keyword: "돼지를-잡는-꿈",
  title: "돼지를 잡는 꿈",
  body: "직접 돼지를 붙잡거나 손으로 제압하는 꿈이다.",
  keyMeaning: "스스로 움직여 얻어내는 성과를 상징한다.",
  numbersText: "3, 17",
  displayOrder: "3",
};

describe("parseNumbersText", () => {
  it("빈 문자열은 빈 배열을 반환한다", () => {
    expect(parseNumbersText("")).toEqual([]);
  });

  it("공백만 있으면 빈 배열을 반환한다", () => {
    expect(parseNumbersText("   ")).toEqual([]);
  });

  it("쉼표로 구분된 숫자를 파싱한다", () => {
    expect(parseNumbersText("3,17")).toEqual([3, 17]);
  });

  it("쉼표+공백 혼합 구분자를 파싱한다", () => {
    expect(parseNumbersText("3, 17,  29")).toEqual([3, 17, 29]);
  });

  it("공백만으로 구분된 숫자를 파싱한다", () => {
    expect(parseNumbersText("3 17 29")).toEqual([3, 17, 29]);
  });

  it("숫자가 아닌 토큰은 예외를 던진다", () => {
    expect(() => parseNumbersText("3, abc")).toThrow(WinningValidationError);
  });
});

describe("validateDreamSituationForm", () => {
  it("유효한 입력을 payload로 변환한다(오름차순 정렬 포함)", () => {
    expect(validateDreamSituationForm({ ...VALID_VALUES, numbersText: "17, 3" })).toEqual({
      keyword: "돼지를-잡는-꿈",
      title: "돼지를 잡는 꿈",
      body: "직접 돼지를 붙잡거나 손으로 제압하는 꿈이다.",
      keyMeaning: "스스로 움직여 얻어내는 성과를 상징한다.",
      numbers: [3, 17],
      displayOrder: 3,
    });
  });

  it("keyword/title/body를 trim한다", () => {
    const result = validateDreamSituationForm({
      ...VALID_VALUES,
      keyword: "  돼지를-잡는-꿈  ",
      title: "  돼지를 잡는 꿈  ",
      body: "  본문  ",
    });
    expect(result).toMatchObject({
      keyword: "돼지를-잡는-꿈",
      title: "돼지를 잡는 꿈",
      body: "본문",
    });
  });

  it("빈 keyMeaning은 null로 변환한다", () => {
    expect(validateDreamSituationForm({ ...VALID_VALUES, keyMeaning: "   " })).toMatchObject({
      keyMeaning: null,
    });
  });

  it("numbersText가 비어 있으면 numbers: []를 반환한다(0개도 유효)", () => {
    expect(validateDreamSituationForm({ ...VALID_VALUES, numbersText: "" })).toMatchObject({
      numbers: [],
    });
  });

  it("numbersText가 정확히 6개면 통과한다", () => {
    expect(
      validateDreamSituationForm({ ...VALID_VALUES, numbersText: "1,2,3,4,5,6" })
    ).toMatchObject({ numbers: [1, 2, 3, 4, 5, 6] });
  });

  it.each([
    ["빈 keyword", { ...VALID_VALUES, keyword: "" }],
    ["공백만 있는 keyword", { ...VALID_VALUES, keyword: "   " }],
    ["keyword 길이 초과", { ...VALID_VALUES, keyword: "가".repeat(51) }],
    ["빈 title", { ...VALID_VALUES, title: "" }],
    ["title 길이 초과", { ...VALID_VALUES, title: "가".repeat(101) }],
    ["빈 body", { ...VALID_VALUES, body: "" }],
    ["body 길이 초과", { ...VALID_VALUES, body: "가".repeat(5001) }],
    ["keyMeaning 길이 초과", { ...VALID_VALUES, keyMeaning: "가".repeat(201) }],
    ["numbers 7개(최대 초과)", { ...VALID_VALUES, numbersText: "1,2,3,4,5,6,7" }],
    ["numbers 범위 밖(0)", { ...VALID_VALUES, numbersText: "0,1" }],
    ["numbers 범위 밖(46)", { ...VALID_VALUES, numbersText: "45,46" }],
    ["numbers 중복", { ...VALID_VALUES, numbersText: "3,3" }],
    ["displayOrder가 정수가 아님", { ...VALID_VALUES, displayOrder: "1.5" }],
    ["displayOrder가 음수", { ...VALID_VALUES, displayOrder: "-1" }],
  ])("rejects: %s", (_label, values) => {
    expect(() => validateDreamSituationForm(values)).toThrow(WinningValidationError);
  });
});
