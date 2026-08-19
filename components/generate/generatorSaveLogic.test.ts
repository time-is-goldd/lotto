import { describe, expect, it } from "vitest";

import {
  buildSaveRequestPayload,
  canAutoSave,
  getRevealDelaysMs,
  getRevealDurationMs,
  getShuffleDurationMs,
  getTotalAnimationDurationMs,
  toSaveKey,
} from "./generatorSaveLogic";

describe("buildSaveRequestPayload", () => {
  it("contains exactly one key, numbers, with the given values", () => {
    const numbers = [1, 2, 3, 4, 5, 6];
    const payload = buildSaveRequestPayload(numbers);

    expect(payload).toEqual({ numbers });
    expect(Object.keys(payload)).toEqual(["numbers"]);
  });

  it("never includes a user_id field regardless of input", () => {
    const payload = buildSaveRequestPayload([1, 2, 3, 4, 5, 6]);

    expect(payload).not.toHaveProperty("user_id");
  });

  it("omits dream fields when dreamContext is null or undefined", () => {
    const numbers = [1, 2, 3, 4, 5, 6];

    expect(buildSaveRequestPayload(numbers, null)).toEqual({ numbers });
    expect(buildSaveRequestPayload(numbers, undefined)).toEqual({ numbers });
  });

  it("includes generationMethod and relatedDreamId when dreamContext is given", () => {
    const numbers = [1, 2, 3, 4, 5, 6];
    const payload = buildSaveRequestPayload(numbers, { id: 5, keyword: "돼지꿈", dreamNumbers: [] });

    expect(payload).toEqual({ numbers, generationMethod: "dream", relatedDreamId: 5 });
  });
});

describe("canAutoSave", () => {
  it("only allows saving when authState is 'ready'", () => {
    expect(canAutoSave("ready")).toBe(true);
    expect(canAutoSave("anonymous")).toBe(false);
    expect(canAutoSave("profile-pending")).toBe(false);
  });
});

describe("generation reveal animation timing (PART A-1/A-2)", () => {
  it("keeps the first-generation total within the 1.5~2.5s envelope and close to ~2s", () => {
    const total = getTotalAnimationDurationMs(true);
    expect(total).toBeGreaterThanOrEqual(1500);
    expect(total).toBeLessThanOrEqual(2500);
    expect(total).toBeCloseTo(1900, -2);
  });

  it("keeps the regenerate total within the 1~1.5s range and faster than first generation", () => {
    const total = getTotalAnimationDurationMs(false);
    expect(total).toBeGreaterThanOrEqual(1000);
    expect(total).toBeLessThanOrEqual(1500);
    expect(total).toBeLessThan(getTotalAnimationDurationMs(true));
  });

  it("never reaches the 5s hard limit regardless of first/regenerate", () => {
    expect(getTotalAnimationDurationMs(true)).toBeLessThan(5000);
    expect(getTotalAnimationDurationMs(false)).toBeLessThan(5000);
  });

  it("reveal duration covers exactly 6 balls at REVEAL_STEP_MS cadence", () => {
    expect(getRevealDurationMs()).toBe(900);
  });

  it("shuffle duration is shorter for regenerate than for the first generation", () => {
    expect(getShuffleDurationMs(false)).toBeLessThan(getShuffleDurationMs(true));
  });

  it("regeneration total stays within the 1.3~1.8s range required by GENERATE_HOME_UX_FIX", () => {
    const total = getTotalAnimationDurationMs(false);
    expect(total).toBeGreaterThanOrEqual(1300);
    expect(total).toBeLessThanOrEqual(1800);
  });
});

describe("getRevealDelaysMs (per-ball reveal schedule, §D)", () => {
  it("returns exactly `count` delays", () => {
    expect(getRevealDelaysMs(6)).toHaveLength(6);
    expect(getRevealDelaysMs(3)).toHaveLength(3);
  });

  it("is strictly increasing with a constant REVEAL_STEP_MS(150ms) spacing", () => {
    const delays = getRevealDelaysMs(6);
    expect(delays).toEqual([150, 300, 450, 600, 750, 900]);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i] - delays[i - 1]).toBe(150);
    }
  });

  it("the per-ball cadence falls within the 100~180ms range requested by §D", () => {
    const delays = getRevealDelaysMs(6);
    const stepSize = delays[1] - delays[0];
    expect(stepSize).toBeGreaterThanOrEqual(100);
    expect(stepSize).toBeLessThanOrEqual(180);
  });

  it("the last delay matches getRevealDurationMs() for 6 balls", () => {
    const delays = getRevealDelaysMs(6);
    expect(delays[delays.length - 1]).toBe(getRevealDurationMs());
  });
});

describe("toSaveKey", () => {
  it("produces the same key for the same numbers array (dedup guard)", () => {
    expect(toSaveKey([1, 2, 3, 4, 5, 6])).toBe(toSaveKey([1, 2, 3, 4, 5, 6]));
  });

  it("produces a different key for different numbers", () => {
    expect(toSaveKey([1, 2, 3, 4, 5, 6])).not.toBe(toSaveKey([2, 3, 4, 5, 6, 7]));
  });
});
