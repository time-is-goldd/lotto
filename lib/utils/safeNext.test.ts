import { describe, expect, it } from "vitest";

import { isSafeNextPath } from "./safeNext";

describe("isSafeNextPath", () => {
  it("accepts an ordinary internal path", () => {
    expect(isSafeNextPath("/generate")).toBe(true);
  });

  it("accepts an internal path with a query string", () => {
    expect(isSafeNextPath("/dream/%EB%8F%BC%EC%A7%80%EA%BF%88")).toBe(true);
  });

  it("rejects null and undefined", () => {
    expect(isSafeNextPath(null)).toBe(false);
    expect(isSafeNextPath(undefined)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeNextPath("")).toBe(false);
  });

  it("rejects a path that does not start with /", () => {
    expect(isSafeNextPath("generate")).toBe(false);
  });

  it("rejects a full external URL", () => {
    expect(isSafeNextPath("https://evil.com")).toBe(false);
  });

  it("rejects a scheme-relative URL (//evil.com)", () => {
    expect(isSafeNextPath("//evil.com")).toBe(false);
  });

  it("rejects a backslash scheme-relative trick (/\\evil.com)", () => {
    expect(isSafeNextPath("/\\evil.com")).toBe(false);
  });

  it("rejects a path containing ://", () => {
    expect(isSafeNextPath("/redirect?to=https://evil.com")).toBe(false);
  });
});
