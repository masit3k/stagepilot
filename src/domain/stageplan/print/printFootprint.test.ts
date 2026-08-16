import { describe, expect, it } from "vitest";
import { STAGEPLAN_BAND_LEADER_LINE } from "../../formatters/stageplan.js";
import {
  type PrintBoxText,
  type PrintTypography,
  computePrintFootprintMm,
} from "./printFootprint.js";
import { measurePrintTextMm } from "./textWidth.js";

/** Skutečná tisková typografie strany 2 po F7. */
const TYPOGRAPHY: PrintTypography = {
  fontSizePt: 8,
  lineHeight: 1.25,
  roleFontSizePt: 7.2,
  roleTrackingEm: 0.14,
  titleGapPt: 6,
  padPt: 6,
  bulletSpacingPx: 4,
  borderPx: 1,
};

const MM_PER_PT = 25.4 / 72;
const MM_PER_PX = 25.4 / 96;
const LINE_MM = 8 * 1.25 * MM_PER_PT; // 3,52778
const PAD_MM = 6 * MM_PER_PT; // 2,11667
const TITLE_GAP_MM = 6 * MM_PER_PT;
const BORDER_MM = 1 * MM_PER_PX; // rámeček boxu, obě strany se přičítají zvlášť

function bulletWidthMm(text: string): number {
  return (
    measurePrintTextMm({ text: "•", style: "boxBody", fontSizePt: 8 }) +
    4 * MM_PER_PX +
    measurePrintTextMm({ text, style: "boxBody", fontSizePt: 8 })
  );
}

function box(overrides: Partial<PrintBoxText> = {}): PrintBoxText {
  return {
    header: "BASS – MATĚJ",
    hasBandLeaderLine: false,
    inputBullets: [],
    monitorBullets: [],
    extraBullets: [],
    hasPowerBadge: false,
    powerBadgeText: "",
    ...overrides,
  };
}

describe("computePrintFootprintMm — výška", () => {
  it("is header plus symmetric padding for a box with nothing else", () => {
    const footprint = computePrintFootprintMm({
      box: box(),
      typography: TYPOGRAPHY,
    });

    expect(footprint.heightMm).toBeCloseTo(
      2 * PAD_MM + 2 * BORDER_MM + LINE_MM,
      4,
    );
  });

  it("adds one box line for the band leader row, with no gap above it", () => {
    const plain = computePrintFootprintMm({
      box: box(),
      typography: TYPOGRAPHY,
    });
    const leader = computePrintFootprintMm({
      box: box({ hasBandLeaderLine: true }),
      typography: TYPOGRAPHY,
    });

    expect(leader.heightMm - plain.heightMm).toBeCloseTo(LINE_MM, 6);
  });

  it("adds the gap below the header only when the box has bullets", () => {
    const bare = computePrintFootprintMm({
      box: box(),
      typography: TYPOGRAPHY,
    });
    const withBullets = computePrintFootprintMm({
      box: box({ inputBullets: ["Bass DI (5)"] }),
      typography: TYPOGRAPHY,
    });

    expect(withBullets.heightMm - bare.heightMm).toBeCloseTo(
      TITLE_GAP_MM + LINE_MM,
      6,
    );
  });

  it("counts the separator line between two non-empty bullet groups", () => {
    const oneGroup = computePrintFootprintMm({
      box: box({ inputBullets: ["a", "b"] }),
      typography: TYPOGRAPHY,
    });
    const twoGroups = computePrintFootprintMm({
      box: box({ inputBullets: ["a"], monitorBullets: ["b"] }),
      typography: TYPOGRAPHY,
    });

    expect(twoGroups.heightMm - oneGroup.heightMm).toBeCloseTo(LINE_MM, 6);
  });

  it("gives the power row a full empty line above it (R8)", () => {
    const withoutPower = computePrintFootprintMm({
      box: box({ inputBullets: ["a", "b"] }),
      typography: TYPOGRAPHY,
    });
    const withPower = computePrintFootprintMm({
      box: box({
        inputBullets: ["a", "b"],
        hasPowerBadge: true,
        powerBadgeText: "1x 230V",
      }),
      typography: TYPOGRAPHY,
    });

    // Mezera je stejně vysoká jako mezera mezi skupinami odrážek — napájení je
    // samostatná informace, ne pokračování poslední odrážky.
    expect(withPower.heightMm - withoutPower.heightMm).toBeCloseTo(
      2 * LINE_MM,
      6,
    );
  });

  it("ignores the zone entirely — a huge zone does not make the box taller", () => {
    // Kdyby zóna do stopy pořád vstupovala, tenhle test by neměl co ověřit:
    // funkce už zónu ani nepřijímá. Test drží podpis (R3).
    const footprint = computePrintFootprintMm({
      box: box({ inputBullets: ["a"] }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.heightMm).toBeCloseTo(
      2 * PAD_MM + 2 * BORDER_MM + LINE_MM + TITLE_GAP_MM + LINE_MM,
      4,
    );
  });

  it("reserves room for its own border, because the width is a border box", () => {
    // `* { box-sizing: border-box }` v styles.ts znamená, že zadaná šířka je
    // šířka vnějšího boxu — rámeček i odsazení se z ní ukrajují. Bez téhle
    // rezervy vyjde obsah o 2 px širší než místo, které na něj zbylo, a
    // nejdelší odrážka vyteče. Přesně to našla smoke kontrola 2.
    const withBorder = computePrintFootprintMm({
      box: box(),
      typography: TYPOGRAPHY,
    });
    const withoutBorder = computePrintFootprintMm({
      box: box(),
      typography: { ...TYPOGRAPHY, borderPx: 0 },
    });

    expect(withBorder.widthMm - withoutBorder.widthMm).toBeCloseTo(
      2 * BORDER_MM,
      9,
    );
    expect(withBorder.heightMm - withoutBorder.heightMm).toBeCloseTo(
      2 * BORDER_MM,
      9,
    );
  });
});

describe("computePrintFootprintMm — šířka", () => {
  it("is set by the longest bullet, bullet glyph and spacing included", () => {
    const footprint = computePrintFootprintMm({
      box: box({
        header: "BASS",
        inputBullets: ["Electric bass guitar (12)"],
        monitorBullets: ["IEM (3)"],
      }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM + 2 * BORDER_MM + bulletWidthMm("Electric bass guitar (12)"),
      6,
    );
    // Zdravý rozum: dnešní box je 36,3 mm široký, tenhle má být širší, ale ne
    // absurdně — kdyby tabulka šířek byla nesmysl, tohle to chytí.
    expect(footprint.widthMm).toBeGreaterThan(30);
    expect(footprint.widthMm).toBeLessThan(60);
  });

  it("lets a long header win over short bullets", () => {
    const footprint = computePrintFootprintMm({
      box: box({ header: "LEAD VOC – ELIŠKA", inputBullets: ["A (1)"] }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM +
        2 * BORDER_MM +
        measurePrintTextMm({
          text: "LEAD VOC – ELIŠKA",
          style: "boxHeader",
          fontSizePt: 8,
        }),
      6,
    );
  });

  it("lets the power row win when it is the longest line", () => {
    const footprint = computePrintFootprintMm({
      box: box({
        header: "KEYS",
        hasPowerBadge: true,
        powerBadgeText: "2x 230V + prodlužovačka",
      }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM +
        2 * BORDER_MM +
        measurePrintTextMm({
          text: "2x 230V + prodlužovačka",
          style: "boxPower",
          fontSizePt: 8,
        }),
      6,
    );
  });

  it("measures the band leader row in the mono cut, tracking included", () => {
    const footprint = computePrintFootprintMm({
      box: box({ header: "BASS", hasBandLeaderLine: true }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM +
        2 * BORDER_MM +
        measurePrintTextMm({
          text: STAGEPLAN_BAND_LEADER_LINE,
          style: "boxRole",
          fontSizePt: 7.2,
          trackingEm: 0.14,
        }),
      6,
    );
  });

  it("ignores the power text when the box has no power row", () => {
    const footprint = computePrintFootprintMm({
      box: box({ header: "BASS", powerBadgeText: "tenhle text se netiskne" }),
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(
      2 * PAD_MM +
        2 * BORDER_MM +
        measurePrintTextMm({ text: "BASS", style: "boxHeader", fontSizePt: 8 }),
      6,
    );
  });
});
