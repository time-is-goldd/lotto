import { describe, expect, it } from "vitest";

import { FALLBACK_ZODIAC_SYMBOL, ZODIAC_SYMBOLS, getZodiacSymbol } from "./zodiacSymbols";

describe("getZodiacSymbol", () => {
  it("returns the correct symbol for each of the 12 known signs", () => {
    expect(getZodiacSymbol("양자리")).toBe("♈");
    expect(getZodiacSymbol("황소자리")).toBe("♉");
    expect(getZodiacSymbol("쌍둥이자리")).toBe("♊");
    expect(getZodiacSymbol("게자리")).toBe("♋");
    expect(getZodiacSymbol("사자자리")).toBe("♌");
    expect(getZodiacSymbol("처녀자리")).toBe("♍");
    expect(getZodiacSymbol("천칭자리")).toBe("♎");
    expect(getZodiacSymbol("전갈자리")).toBe("♏");
    expect(getZodiacSymbol("사수자리")).toBe("♐");
    expect(getZodiacSymbol("염소자리")).toBe("♑");
    expect(getZodiacSymbol("물병자리")).toBe("♒");
    expect(getZodiacSymbol("물고기자리")).toBe("♓");
  });

  it("has exactly 12 entries in the mapping table", () => {
    expect(Object.keys(ZODIAC_SYMBOLS)).toHaveLength(12);
  });

  it("falls back for null", () => {
    expect(getZodiacSymbol(null)).toBe(FALLBACK_ZODIAC_SYMBOL);
  });

  it("falls back for an unrecognized string without throwing", () => {
    expect(getZodiacSymbol("존재하지않는별자리")).toBe(FALLBACK_ZODIAC_SYMBOL);
  });
});
