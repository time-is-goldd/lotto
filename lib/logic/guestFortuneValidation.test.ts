import { describe, expect, it } from "vitest";

import {
  isFutureDate,
  isUnrealisticallyOldDate,
  isValidCalendarDate,
  validateGuestFortuneInput,
} from "./guestFortuneValidation";

describe("isValidCalendarDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidCalendarDate("2000-01-01")).toBe(true);
    expect(isValidCalendarDate("2024-02-29")).toBe(true); // 윤년
  });

  it("rejects a non-existent calendar date", () => {
    expect(isValidCalendarDate("2024-02-30")).toBe(false);
    expect(isValidCalendarDate("2023-02-29")).toBe(false); // 평년
    expect(isValidCalendarDate("2024-04-31")).toBe(false);
    expect(isValidCalendarDate("2024-13-01")).toBe(false);
    expect(isValidCalendarDate("2024-00-10")).toBe(false);
  });

  it("rejects malformed strings", () => {
    expect(isValidCalendarDate("2024-1-1")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
    expect(isValidCalendarDate("")).toBe(false);
  });
});

describe("isFutureDate", () => {
  it("treats a later date as future", () => {
    expect(isFutureDate("2026-08-20", "2026-08-19")).toBe(true);
  });

  it("treats today and earlier dates as not future", () => {
    expect(isFutureDate("2026-08-19", "2026-08-19")).toBe(false);
    expect(isFutureDate("2026-08-18", "2026-08-19")).toBe(false);
  });
});

describe("isUnrealisticallyOldDate", () => {
  it("rejects a birth year more than 130 years before today", () => {
    expect(isUnrealisticallyOldDate("1890-01-01", "2026-08-19")).toBe(true);
  });

  it("accepts a birth year within 130 years of today", () => {
    expect(isUnrealisticallyOldDate("1995-03-14", "2026-08-19")).toBe(false);
  });

  it("accepts a very recent birth year (infant/child)", () => {
    expect(isUnrealisticallyOldDate("2024-01-01", "2026-08-19")).toBe(false);
  });
});

describe("validateGuestFortuneInput", () => {
  const TODAY = "2026-08-19";

  it("passes with only birthDate (gender/birthTime omitted)", () => {
    const result = validateGuestFortuneInput({ birthDate: "2000-01-01" }, TODAY);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("passes with gender 'N' and no birthTime", () => {
    const result = validateGuestFortuneInput({ birthDate: "2000-01-01", gender: "N" }, TODAY);
    expect(result.ok).toBe(true);
  });

  it("passes with a full valid input including gender and birthTime", () => {
    const result = validateGuestFortuneInput(
      { birthDate: "2000-01-01", gender: "F", birthTime: "14:30" },
      TODAY
    );
    expect(result.ok).toBe(true);
  });

  // §10: 공개 운세 열람에는 19세 제한이 없다 — 미성년자/아동 생년월일도 정상 통과해야 한다.
  it("passes for a minor's birth date (no age gate on guest fortune)", () => {
    const result = validateGuestFortuneInput({ birthDate: "2015-06-01" }, TODAY);
    expect(result.ok).toBe(true);
    expect(result.errors.birthDate).toBeUndefined();
  });

  it("passes for a very recent birth date (infant)", () => {
    const result = validateGuestFortuneInput({ birthDate: "2025-01-01" }, TODAY);
    expect(result.ok).toBe(true);
  });

  it("fails when birthDate is missing", () => {
    const result = validateGuestFortuneInput({ birthDate: "" }, TODAY);
    expect(result.ok).toBe(false);
    expect(result.errors.birthDate).toBe("생년월일을 입력해주세요.");
  });

  it("fails on a future birthDate", () => {
    const result = validateGuestFortuneInput({ birthDate: "2026-08-20" }, TODAY);
    expect(result.ok).toBe(false);
    expect(result.errors.birthDate).toBe("미래 날짜는 입력할 수 없어요.");
  });

  it("fails on a non-existent calendar date with a specific month/day message", () => {
    const result = validateGuestFortuneInput({ birthDate: "2024-02-30" }, TODAY);
    expect(result.ok).toBe(false);
    expect(result.errors.birthDate).toBe("2월 30일은 존재하지 않는 날짜예요.");
  });

  it("fails on April 31st (30-day month)", () => {
    const result = validateGuestFortuneInput({ birthDate: "2024-04-31" }, TODAY);
    expect(result.ok).toBe(false);
    expect(result.errors.birthDate).toBe("4월 31일은 존재하지 않는 날짜예요.");
  });

  it("fails on Feb 29 in a non-leap year", () => {
    const result = validateGuestFortuneInput({ birthDate: "2023-02-29" }, TODAY);
    expect(result.ok).toBe(false);
    expect(result.errors.birthDate).toBe("2월 29일은 존재하지 않는 날짜예요.");
  });

  it("passes on Feb 29 in a leap year", () => {
    const result = validateGuestFortuneInput({ birthDate: "2024-02-29" }, TODAY);
    expect(result.ok).toBe(true);
  });

  it("fails on an unrealistically old birth date", () => {
    const result = validateGuestFortuneInput({ birthDate: "1850-01-01" }, TODAY);
    expect(result.ok).toBe(false);
    expect(result.errors.birthDate).toBe("생년월일을 다시 확인해주세요.");
  });

  it("fails on an invalid gender value", () => {
    const result = validateGuestFortuneInput({ birthDate: "2000-01-01", gender: "X" }, TODAY);
    expect(result.ok).toBe(false);
    expect(result.errors.gender).toBeDefined();
  });

  it("fails on a malformed birthTime", () => {
    const result = validateGuestFortuneInput(
      { birthDate: "2000-01-01", birthTime: "25:99" },
      TODAY
    );
    expect(result.ok).toBe(false);
    expect(result.errors.birthTime).toBeDefined();
  });

  it("accepts birthTime with seconds (HH:MM:SS)", () => {
    const result = validateGuestFortuneInput(
      { birthDate: "2000-01-01", birthTime: "14:30:00" },
      TODAY
    );
    expect(result.ok).toBe(true);
  });
});
