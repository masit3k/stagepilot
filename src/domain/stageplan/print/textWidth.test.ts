import { describe, expect, it } from "vitest";
import { GLYPH_ADVANCES } from "./glyphAdvances.js";
import { measurePrintTextMm } from "./textWidth.js";

const MM_PER_PT = 25.4 / 72;

describe("measurePrintTextMm", () => {
  it("measures nothing for an empty string", () => {
    expect(
      measurePrintTextMm({ text: "", style: "boxBody", fontSizePt: 8 }),
    ).toBe(0);
  });

  it("sums the advances of its characters", () => {
    const advances = GLYPH_ADVANCES.boxBody.advances;
    const expected =
      (advances.B + advances.a + advances.s + advances.s) * 8 * MM_PER_PT;

    expect(
      measurePrintTextMm({ text: "Bass", style: "boxBody", fontSizePt: 8 }),
    ).toBeCloseTo(expected, 9);
  });

  it("scales linearly with the font size", () => {
    const small = measurePrintTextMm({
      text: "Drums (1–8)",
      style: "boxBody",
      fontSizePt: 8,
    });
    const large = measurePrintTextMm({
      text: "Drums (1–8)",
      style: "boxBody",
      fontSizePt: 16,
    });

    expect(large).toBeCloseTo(2 * small, 9);
  });

  it("gives an unknown character the widest advance of its own table", () => {
    // Řecká omega v korpusu není. Širší odhad je vědomá volba: opačná chyba
    // by znamenala uříznuté číslo kanálu (R1).
    const unknown = measurePrintTextMm({
      text: "Ω",
      style: "boxBody",
      fontSizePt: 8,
    });

    expect(unknown).toBeCloseTo(
      GLYPH_ADVANCES.boxBody.maxAdvance * 8 * MM_PER_PT,
      9,
    );
  });

  it("adds tracking after every character, including the last one", () => {
    const plain = measurePrintTextMm({
      text: "BANDLEADER",
      style: "boxRole",
      fontSizePt: 7.2,
    });
    const tracked = measurePrintTextMm({
      text: "BANDLEADER",
      style: "boxRole",
      fontSizePt: 7.2,
      trackingEm: 0.14,
    });

    // Deset znaků, tedy deset prostrků — Chromium sází letter-spacing i za
    // poslední znak, takže box musí počítat s desíti, ne s devíti.
    expect(tracked - plain).toBeCloseTo(10 * 0.14 * 7.2 * MM_PER_PT, 9);
  });

  it("counts a character, not a UTF-16 code unit", () => {
    // Znak mimo BMP je jeden znak, ne dva. Kdyby se iterovalo přes indexy,
    // dostal by maxAdvance dvakrát.
    const one = measurePrintTextMm({
      text: "😀",
      style: "boxBody",
      fontSizePt: 8,
    });

    expect(one).toBeCloseTo(
      GLYPH_ADVANCES.boxBody.maxAdvance * 8 * MM_PER_PT,
      9,
    );
  });
});
