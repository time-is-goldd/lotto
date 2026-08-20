import { describe, expect, it } from "vitest";

import {
  buildDailyGeneratePayload,
  buildSaveRequestPayload,
  canSaveNumbers,
  getRevealDelaysMs,
  getRevealDurationMs,
  REVEAL_STEP_MS,
  toGuestDailyCombo,
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

describe("buildDailyGeneratePayload", () => {
  it("includes an empty dreamNumbers array and no dream fields without dreamContext", () => {
    const numbers = [1, 2, 3, 4, 5, 6];
    expect(buildDailyGeneratePayload(numbers, [], null)).toEqual({ numbers, dreamNumbers: [] });
  });

  it("includes dreamNumbers/generationMethod/relatedDreamId when dreamContext is given", () => {
    const numbers = [1, 2, 3, 4, 5, 6];
    const payload = buildDailyGeneratePayload(numbers, [1, 2], {
      id: 5,
      keyword: "돼지꿈",
      dreamNumbers: [1, 2],
    });

    expect(payload).toEqual({
      numbers,
      dreamNumbers: [1, 2],
      generationMethod: "dream",
      relatedDreamId: 5,
    });
  });
});

describe("toGuestDailyCombo", () => {
  it("marks source as general and dreamNumbers empty without dreamContext", () => {
    const combo = toGuestDailyCombo([1, 2, 3, 4, 5, 6], [], null, "2026-08-19T00:00:00.000Z");
    expect(combo).toEqual({
      numbers: [1, 2, 3, 4, 5, 6],
      source: "general",
      dreamNumbers: [],
      relatedDreamId: null,
      generatedAt: "2026-08-19T00:00:00.000Z",
    });
  });

  it("marks source as dream and carries relatedDreamId/dreamNumbers with dreamContext", () => {
    const combo = toGuestDailyCombo(
      [1, 2, 3, 4, 5, 6],
      [1, 2],
      { id: 7, keyword: "뱀꿈", dreamNumbers: [1, 2] },
      "2026-08-19T00:00:00.000Z"
    );
    expect(combo).toEqual({
      numbers: [1, 2, 3, 4, 5, 6],
      source: "dream",
      dreamNumbers: [1, 2],
      relatedDreamId: 7,
      generatedAt: "2026-08-19T00:00:00.000Z",
    });
  });
});

describe("canSaveNumbers", () => {
  it("only allows saving when authState is 'ready'", () => {
    expect(canSaveNumbers("ready")).toBe(true);
    expect(canSaveNumbers("anonymous")).toBe(false);
    expect(canSaveNumbers("profile-pending")).toBe(false);
  });
});

describe("reveal animation timing (claude-code-luck-platform-home-brand-daily-numbers-prompt.md §3.5)", () => {
  it("totals ~700ms (6 balls at REVEAL_STEP_MS cadence), never a slot-machine-length shuffle", () => {
    const total = getRevealDurationMs();
    expect(total).toBeGreaterThanOrEqual(600);
    expect(total).toBeLessThanOrEqual(800);
    expect(total).toBe(REVEAL_STEP_MS * 6);
  });
});

describe("getRevealDelaysMs (per-ball reveal schedule)", () => {
  it("returns exactly `count` delays", () => {
    expect(getRevealDelaysMs(6)).toHaveLength(6);
    expect(getRevealDelaysMs(3)).toHaveLength(3);
  });

  it("is strictly increasing with a constant REVEAL_STEP_MS spacing", () => {
    const delays = getRevealDelaysMs(6);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i] - delays[i - 1]).toBe(REVEAL_STEP_MS);
    }
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
