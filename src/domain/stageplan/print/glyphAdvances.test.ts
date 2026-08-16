import { describe, expect, it } from "vitest";
import {
  GLYPH_ADVANCES,
  PRINT_TEXT_STYLES,
  type PrintTextStyle,
} from "./glyphAdvances.js";

/**
 * Znaky, které se v tištěném boxu opravdu objevují: česká abeceda v obou
 * velikostech, číslice a interpunkce z odrážek. Chybějící znak by dostal
 * `maxAdvance`, takže by box vyšel zbytečně široký — tenhle test to odhalí
 * dřív než pohled na papír.
 */
const REQUIRED_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž" +
  "0123456789" +
  " .,:;()+-/&%*'\"–—•·×°";

describe("GLYPH_ADVANCES", () => {
  it("has a table for each of the four printed styles", () => {
    expect(PRINT_TEXT_STYLES).toEqual([
      "boxHeader",
      "boxRole",
      "boxBody",
      "boxPower",
    ]);
    for (const style of PRINT_TEXT_STYLES) {
      expect(
        Object.keys(GLYPH_ADVANCES[style].advances).length,
      ).toBeGreaterThan(100);
    }
  });

  it("covers every character the printed box can contain", () => {
    for (const style of PRINT_TEXT_STYLES) {
      const missing = [...REQUIRED_CHARS].filter(
        (char) => GLYPH_ADVANCES[style].advances[char] === undefined,
      );
      expect({ style, missing }).toEqual({ style, missing: [] });
    }
  });

  it("keeps every advance a plausible fraction of the font size", () => {
    for (const style of PRINT_TEXT_STYLES) {
      for (const [char, advance] of Object.entries(
        GLYPH_ADVANCES[style].advances,
      )) {
        expect({ style, char, ok: advance > 0 && advance < 2 }).toEqual({
          style,
          char,
          ok: true,
        });
      }
    }
  });

  it("keeps maxAdvance the widest glyph of its own table", () => {
    for (const style of PRINT_TEXT_STYLES) {
      const table = GLYPH_ADVANCES[style];
      expect(table.maxAdvance).toBeCloseTo(
        Math.max(...Object.values(table.advances)),
        6,
      );
    }
  });

  it("measured four distinct cuts, not one table copied four times", () => {
    // Tučný nadpis musí být širší než základní řez a mono řez musí mít
    // všechny znaky stejně široké — kdyby generátor zapomněl přepnout
    // font-weight nebo font-family, tabulky by si byly rovné.
    const widthOf = (style: PrintTextStyle, char: string) =>
      GLYPH_ADVANCES[style].advances[char];

    expect(widthOf("boxHeader", "M")).toBeGreaterThan(widthOf("boxBody", "M"));
    expect(widthOf("boxPower", "M")).toBeGreaterThan(widthOf("boxBody", "M"));
    expect(widthOf("boxRole", "i")).toBeCloseTo(widthOf("boxRole", "M"), 6);
    expect(widthOf("boxBody", "i")).toBeLessThan(widthOf("boxBody", "M"));
  });
});
