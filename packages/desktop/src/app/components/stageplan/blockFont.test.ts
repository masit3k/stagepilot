import { describe, expect, it } from "vitest";
import {
  BLOCK_FONT_MAX_PX,
  BLOCK_FONT_MIN_PX,
  resolveBlockFontPx,
} from "./blockFont";

/** Tiskové písmo boxu je 8 pt a měřítko výchozího plánu ~12,885 mm/m. */
const PRINT = { fontSizePt: 8, mmPerM: 12.885 };

describe("resolveBlockFontPx", () => {
  it("caps at the readable maximum on a large canvas", () => {
    // 75 px/m → 5,82 px na mm papíru → proporce ~16,4 px, tedy nad stropem.
    expect(resolveBlockFontPx({ ...PRINT, pxPerM: 75 })).toBe(
      BLOCK_FONT_MAX_PX,
    );
  });

  it("follows the print proportion once it drops below the maximum", () => {
    // 35 px/m → 2,716 px na mm papíru → proporce ~7,67 px.
    const fontPx = resolveBlockFontPx({ ...PRINT, pxPerM: 35 });

    expect(fontPx).not.toBeNull();
    expect(fontPx as number).toBeGreaterThan(BLOCK_FONT_MIN_PX);
    expect(fontPx as number).toBeLessThan(BLOCK_FONT_MAX_PX);
  });

  it("gives up below the legibility floor so only the header stays", () => {
    // 30 px/m → proporce ~6,57 px. Nečitelný text je horší než žádný (R5).
    expect(resolveBlockFontPx({ ...PRINT, pxPerM: 30 })).toBeNull();
  });
});
