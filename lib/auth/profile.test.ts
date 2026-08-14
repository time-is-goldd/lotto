import { describe, expect, it } from "vitest";

import {
  ProfileValidationError,
  calculateAgeVerified,
  parseProfileCreateInput,
  parseProfileUpdateInput,
} from "@/lib/auth/profile";

// calculateAgeVerified는 UTC 기준으로 오늘을 판단하므로(profile.ts 주석 참조), 테스트도
// new Date().toISOString()(로컬→UTC 변환)을 거치지 않고 UTC getter로 직접 문자열을
// 만든다 — 로컬 타임존에 따라 날짜가 하루 밀려 테스트가 실행 환경에 따라 flaky해지는
// 것을 방지한다.
function isoDateUtc(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${month}-${paddedDay}`;
}

describe("calculateAgeVerified", () => {
  it("returns true for a birth date exactly 19 years ago today", () => {
    const today = new Date();
    const birthDate = isoDateUtc(
      today.getUTCFullYear() - 19,
      today.getUTCMonth(),
      today.getUTCDate()
    );

    expect(calculateAgeVerified(birthDate)).toBe(true);
  });

  it("returns false the day before the 19th birthday", () => {
    const today = new Date();
    const birthDate = isoDateUtc(
      today.getUTCFullYear() - 19,
      today.getUTCMonth(),
      today.getUTCDate() + 1
    );

    expect(calculateAgeVerified(birthDate)).toBe(false);
  });
});

describe("parseProfileCreateInput", () => {
  const validBody = {
    nickname: "행운가득",
    birth_date: "2000-01-01",
  };

  it("parses a minimal valid body with defaults applied", () => {
    expect(parseProfileCreateInput(validBody)).toEqual({
      nickname: "행운가득",
      birth_date: "2000-01-01",
      gender: null,
      birth_time: null,
      marketing_opt_in: false,
      privacy_public_default: true,
    });
  });

  it("rejects a missing nickname", () => {
    expect(() => parseProfileCreateInput({ birth_date: "2000-01-01" })).toThrow(
      ProfileValidationError
    );
  });

  it("rejects an invalid birth_date format", () => {
    expect(() => parseProfileCreateInput({ ...validBody, birth_date: "2000/01/01" })).toThrow(
      ProfileValidationError
    );
  });

  it("rejects a future birth_date", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    expect(() =>
      parseProfileCreateInput({ ...validBody, birth_date: future.toISOString().slice(0, 10) })
    ).toThrow(ProfileValidationError);
  });

  it("never reads client-provided provider/status/age_verified", () => {
    const result = parseProfileCreateInput({
      ...validBody,
      provider: "kakao",
      status: "active",
      age_verified: true,
    });

    expect(result).not.toHaveProperty("provider");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("age_verified");
  });
});

describe("parseProfileUpdateInput", () => {
  it("keeps only whitelisted fields", () => {
    const result = parseProfileUpdateInput({
      nickname: "새닉네임",
      provider: "kakao",
      status: "suspended",
      age_verified: true,
      birth_date: "1999-01-01",
    });

    expect(result).toEqual({ nickname: "새닉네임" });
  });

  it("throws when no updatable field is present in the body", () => {
    expect(() => parseProfileUpdateInput({ provider: "kakao" })).toThrow(ProfileValidationError);
  });

  it("rejects an invalid gender value", () => {
    expect(() => parseProfileUpdateInput({ gender: "X" })).toThrow(ProfileValidationError);
  });
});
