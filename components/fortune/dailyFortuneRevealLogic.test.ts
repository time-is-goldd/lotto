import { describe, expect, it } from "vitest";

import { shouldAnimateReveal } from "./dailyFortuneRevealLogic";

describe("shouldAnimateReveal (production animation rule, §3)", () => {
  it("animates when isNew=true and the user does not prefer reduced motion", () => {
    expect(shouldAnimateReveal(true, false)).toBe(true);
  });

  it("does not animate on a same-day revisit (isNew=false), regardless of motion preference", () => {
    expect(shouldAnimateReveal(false, false)).toBe(false);
    expect(shouldAnimateReveal(false, true)).toBe(false);
  });

  it("does not animate when the user prefers reduced motion, even if isNew=true", () => {
    expect(shouldAnimateReveal(true, true)).toBe(false);
  });
});
