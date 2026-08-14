import { describe, expect, it } from "vitest";

import { LUCKY_COLORS } from "./luckyColor";
import { FALLBACK_COLOR_SWATCH, LUCKY_COLOR_SWATCHES, getColorSwatch } from "./colorSwatches";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

describe("getColorSwatch", () => {
  it("maps every color name in LUCKY_COLORS (the actual content bank) to a swatch", () => {
    for (const name of LUCKY_COLORS) {
      const swatch = getColorSwatch(name);
      expect(swatch).toMatch(HEX_COLOR_PATTERN);
      expect(swatch).not.toBe(FALLBACK_COLOR_SWATCH);
    }
  });

  it("falls back to a neutral swatch for null", () => {
    expect(getColorSwatch(null)).toBe(FALLBACK_COLOR_SWATCH);
  });

  it("falls back to a neutral swatch for an unrecognized color name (never throws/breaks UI)", () => {
    expect(getColorSwatch("존재하지않는색")).toBe(FALLBACK_COLOR_SWATCH);
  });

  it("every mapping table value is a valid hex color", () => {
    for (const hex of Object.values(LUCKY_COLOR_SWATCHES)) {
      expect(hex).toMatch(HEX_COLOR_PATTERN);
    }
  });
});
