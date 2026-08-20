import { describe, expect, it } from "vitest";

import {
  combineIfComplete,
  distributeDigits,
  normalizeTwoDigit,
  onlyDigits,
  parsePartsFromValue,
} from "./birthDateSplitInputLogic";

describe("onlyDigits", () => {
  it("strips non-digit characters", () => {
    expect(onlyDigits("1999-01-10")).toBe("19990110");
    expect(onlyDigits("1999.01.10")).toBe("19990110");
    expect(onlyDigits("abc123def")).toBe("123");
  });
});

describe("distributeDigits", () => {
  it("distributes a plain 8-digit paste (19990110)", () => {
    expect(distributeDigits("19990110")).toEqual({ year: "1999", month: "01", day: "10" });
  });

  it("distributes a hyphenated paste (1999-01-10)", () => {
    expect(distributeDigits("1999-01-10")).toEqual({ year: "1999", month: "01", day: "10" });
  });

  it("distributes a dot-separated paste (1999.01.10)", () => {
    expect(distributeDigits("1999.01.10")).toEqual({ year: "1999", month: "01", day: "10" });
  });

  it("returns null for fewer than 8 digits (partial paste)", () => {
    expect(distributeDigits("1999-01")).toBeNull();
  });

  it("returns null for more than 8 digits", () => {
    expect(distributeDigits("199901100")).toBeNull();
  });

  it("returns null for non-numeric text", () => {
    expect(distributeDigits("hello world")).toBeNull();
  });
});

describe("parsePartsFromValue", () => {
  it("parses a valid YYYY-MM-DD value", () => {
    expect(parsePartsFromValue("1999-01-10")).toEqual({ year: "1999", month: "01", day: "10" });
  });

  it("returns empty parts for an empty or malformed value", () => {
    expect(parsePartsFromValue("")).toEqual({ year: "", month: "", day: "" });
    expect(parsePartsFromValue("not-a-date")).toEqual({ year: "", month: "", day: "" });
  });
});

describe("normalizeTwoDigit", () => {
  it("pads a single digit with a leading zero", () => {
    expect(normalizeTwoDigit("1")).toBe("01");
    expect(normalizeTwoDigit("9")).toBe("09");
  });

  it("leaves a two-digit value unchanged", () => {
    expect(normalizeTwoDigit("10")).toBe("10");
    expect(normalizeTwoDigit("01")).toBe("01");
  });

  it("leaves an empty value unchanged", () => {
    expect(normalizeTwoDigit("")).toBe("");
  });
});

describe("combineIfComplete", () => {
  it("combines a fully-filled year/month/day into YYYY-MM-DD", () => {
    expect(combineIfComplete({ year: "1999", month: "01", day: "10" })).toBe("1999-01-10");
  });

  it("normalizes single-digit month/day while combining", () => {
    expect(combineIfComplete({ year: "1999", month: "1", day: "5" })).toBe("1999-01-05");
  });

  it("returns null when the year is incomplete", () => {
    expect(combineIfComplete({ year: "199", month: "01", day: "10" })).toBeNull();
  });

  it("returns null when the month or day is empty", () => {
    expect(combineIfComplete({ year: "1999", month: "", day: "10" })).toBeNull();
    expect(combineIfComplete({ year: "1999", month: "01", day: "" })).toBeNull();
  });
});
