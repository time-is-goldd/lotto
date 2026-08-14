import { describe, expect, it } from "vitest";

import { getKstDateString } from "./kstDate";

describe("getKstDateString", () => {
  it("returns YYYY-MM-DD zero-padded for an ordinary UTC midday timestamp", () => {
    // UTC 2026-08-11T12:00:00Z = KST 2026-08-11T21:00:00 (같은 날짜, 모호함 없음)
    expect(getKstDateString(new Date("2026-08-11T12:00:00Z"))).toBe("2026-08-11");
  });

  it("stays on the previous KST date at 23:59:59 KST", () => {
    // KST 2026-08-11T23:59:59 = UTC 2026-08-11T14:59:59Z
    expect(getKstDateString(new Date("2026-08-11T14:59:59Z"))).toBe("2026-08-11");
  });

  it("rolls over to the next KST date exactly at 00:00:00 KST", () => {
    // KST 2026-08-12T00:00:00 = UTC 2026-08-11T15:00:00Z — 1초 차이로 날짜가 바뀐다
    expect(getKstDateString(new Date("2026-08-11T15:00:00Z"))).toBe("2026-08-12");
  });

  it("differs from the naive UTC date exactly during the KST-ahead 09:00 window", () => {
    // UTC 2026-08-11T20:00:00Z = KST 2026-08-12T05:00:00 — UTC 기준 날짜(08-11)와
    // KST 기준 날짜(08-12)가 다르다. UTC 기준 로직(todayDateString())을 쓰면 틀리는 지점.
    const kst = getKstDateString(new Date("2026-08-11T20:00:00Z"));
    const naiveUtc = new Date("2026-08-11T20:00:00Z").toISOString().slice(0, 10);
    expect(kst).toBe("2026-08-12");
    expect(kst).not.toBe(naiveUtc);
  });

  it("zero-pads single-digit month and day", () => {
    expect(getKstDateString(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });

  it("defaults to the current time when no argument is given", () => {
    expect(() => getKstDateString()).not.toThrow();
    expect(getKstDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
