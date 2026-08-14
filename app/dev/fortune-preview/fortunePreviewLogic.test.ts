import { describe, expect, it } from "vitest";

import { nextReplayKey, reducePreviewPhase } from "./fortunePreviewLogic";

describe("reducePreviewPhase", () => {
  it("starts as idle and moves to revealing on start", () => {
    expect(reducePreviewPhase("idle", "start")).toBe("revealing");
  });

  it("moves from revealing to done on complete", () => {
    expect(reducePreviewPhase("revealing", "complete")).toBe("done");
  });

  it("moves from done back to revealing on replay", () => {
    expect(reducePreviewPhase("done", "replay")).toBe("revealing");
  });

  it("replay always resets to revealing regardless of current phase", () => {
    expect(reducePreviewPhase("idle", "replay")).toBe("revealing");
    expect(reducePreviewPhase("revealing", "replay")).toBe("revealing");
    expect(reducePreviewPhase("done", "replay")).toBe("revealing");
  });
});

describe("nextReplayKey", () => {
  it("increments so DailyFortuneCard remounts with a fresh key", () => {
    expect(nextReplayKey(0)).toBe(1);
    expect(nextReplayKey(1)).toBe(2);
  });

  it("never repeats a previous key across successive replays", () => {
    let key = 0;
    const seen = new Set([key]);
    for (let i = 0; i < 5; i++) {
      key = nextReplayKey(key);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
