import { describe, expect, it } from "vitest";
import { NOMINAL_STAGE } from "../layout/defaultLayout.js";
import {
  type PrintScaleBlock,
  resolvePrintScale,
  toPrintScaleBlock,
} from "./printScale.js";

/** Skutečná tisková plocha strany 2 po F7 (hlavička s kontaktem, bez vysvětlivky). */
const AREA = { widthMm: 162.5375, heightMm: 197.1382 };

function scaleBlock(overrides: Partial<PrintScaleBlock> = {}): PrintScaleBlock {
  return {
    zoneWidthM: 2.6,
    zoneDepthM: 1.2,
    boxWidthMm: 38.6,
    boxHeightMm: 25,
    ...overrides,
  };
}

describe("resolvePrintScale", () => {
  it("falls back to the tolerance-only scale for an empty layout", () => {
    const scale = resolvePrintScale({ stage: null, blocks: [], area: AREA });

    // Nominál 12 × 8 m plus 2 × 20 cm tolerance:
    // šířka 162,5375 / 12,4 = 13,1079; výška 197,1382 / 8,4 = 23,4688 → váže šířka.
    expect(scale.mmPerM).toBeCloseTo(13.1079, 3);
    expect(scale.planWidthMm).toBeCloseTo(157.294, 2);
  });

  it("reserves width for the block whose box outgrows its zone", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [scaleBlock()],
      area: AREA,
    });

    // Zóna 2,6 m dá při 13,1079 jen 34,08 mm, box chce 38,6 mm:
    // (162,5375 − 38,6) / (12,4 − 2,6) = 12,6467 mm/m.
    expect(scale.mmPerM).toBeCloseTo(12.6467, 3);
  });

  it("reserves nothing for a block whose zone already carries its box", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [scaleBlock({ zoneWidthM: 6, zoneDepthM: 4 })],
      area: AREA,
    });

    // 6 m dá 78,6 mm, box chce 38,6 — zóna vyhrává, rezerva se neuplatní.
    expect(scale.mmPerM).toBeCloseTo(13.1079, 3);
  });

  it("takes the tightest block, not the first one", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [
        scaleBlock({ zoneWidthM: 2.8, boxWidthMm: 37 }),
        scaleBlock({ zoneWidthM: 2.6, boxWidthMm: 44 }),
      ],
      area: AREA,
    });

    // Druhý blok: (162,5375 − 44) / 9,8 = 12,0957 — a ten je přísnější.
    expect(scale.mmPerM).toBeCloseTo(12.0957, 3);
  });

  it("reserves height too, where the budget used to have a hole (R6)", () => {
    // Dnes se výška počítá jen jako plocha / hloubka s přesahem, takže vysoký
    // box u horní hrany pódia plochu přeroste a rozpočet o tom neví.
    const scale = resolvePrintScale({
      stage: { widthM: 8, depthM: 14 },
      blocks: [scaleBlock({ zoneDepthM: 1.2, boxHeightMm: 40 })],
      area: AREA,
    });

    // Výšková mez bez rezervy: 197,1382 / 14,4 = 13,6902.
    // S rezervou: (197,1382 − 40) / (14,4 − 1,2) = 11,9044 — a ta váže.
    expect(scale.mmPerM).toBeCloseTo(11.9044, 3);
  });

  it("leaves the scale alone when a box is wider than the whole area", () => {
    // Rezervovat nejde; má spadnout pojistka a pojmenovat viníka (R5), ne
    // vyjít záporné nebo nulové měřítko.
    const scale = resolvePrintScale({
      stage: null,
      blocks: [scaleBlock({ boxWidthMm: 200 })],
      area: AREA,
    });

    expect(scale.mmPerM).toBeGreaterThan(0);
    expect(scale.mmPerM).toBeCloseTo(13.1079, 3);
  });

  it("never returns a scale larger than the unreserved one", () => {
    const reserved = resolvePrintScale({
      stage: null,
      blocks: [scaleBlock()],
      area: AREA,
    });
    const unreservedMmPerM = Math.min(
      AREA.widthMm / NOMINAL_STAGE.widthM,
      AREA.heightMm / NOMINAL_STAGE.depthM,
    );

    expect(reserved.mmPerM).toBeLessThan(unreservedMmPerM);
  });

  it("round-trips metres through millimetres", () => {
    const scale = resolvePrintScale({
      stage: { widthM: 11, depthM: 7 },
      blocks: [],
      area: AREA,
    });

    expect(scale.toM(scale.toMm(3.75))).toBeCloseTo(3.75, 6);
  });
});

describe("toPrintScaleBlock", () => {
  it("pairs each axis with its own measurement", () => {
    // Zóna i stopa jsou schválně nečtvercové, jinak by prohození os nešlo
    // poznat — a prohození je jediná chyba, kterou tenhle převod umí udělat.
    const block = toPrintScaleBlock({
      zone: { widthM: 2.7, depthM: 1.4 },
      footprint: { widthMm: 38.6, heightMm: 25.1 },
    });

    expect(block).toEqual({
      zoneWidthM: 2.7,
      zoneDepthM: 1.4,
      boxWidthMm: 38.6,
      boxHeightMm: 25.1,
    });
  });
});
