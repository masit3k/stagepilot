import { describe, expect, it } from "vitest";
import type { StageplanBlock } from "../../model/types.js";
import { NOMINAL_STAGE } from "../layout/defaultLayout.js";
import { rectAabbMm } from "./printCollisions.js";
import { resolvePrintScale } from "./printScale.js";

/** Skutečná tisková plocha strany 2 — stejná čísla, s jakými počítá renderer. */
const AREA = { widthMm: 162.5375, heightMm: 202.0914 };
const MIN_BOX_WIDTH_MM = 36.2594;

function block(overrides: Partial<StageplanBlock> = {}): StageplanBlock {
  return {
    slot: "lead_voc_1",
    centerXM: 6,
    centerYM: 5.5,
    widthM: 2.6,
    depthM: 1.2,
    rotationDeg: 0,
    ...overrides,
  };
}

describe("resolvePrintScale", () => {
  it("leaves room for the legal overhang and for a box wider than its zone", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [block()],
      area: AREA,
      minBoxWidthMm: MIN_BOX_WIDTH_MM,
    });

    // Nominál 12 m + 2 × 20 cm tolerance, a nejužší zóna 2,6 m roste na 36,2594 mm:
    // (162,5375 − 36,2594) / (12 + 0,4 − 2,6) = 12,8855 mm/m
    expect(scale.mmPerM).toBeCloseTo(12.8855, 3);
    expect(scale.planWidthMm).toBeCloseTo(154.626, 2);
  });

  it("keeps a block at the legal edge inside the print area", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [block({ centerXM: 1.1 })],
      area: AREA,
      minBoxWidthMm: MIN_BOX_WIDTH_MM,
    });

    // Stejný union bbox, jaký sází kontejner v rendereru (R11): rám pódia
    // 0..planWidthMm plus opsaný obdélník boxu. Zóna 2,6 m je pod podlahou,
    // takže box na téhle šířce sedí přesně na MIN_BOX_WIDTH_MM.
    const box = rectAabbMm({
      slot: "lead_voc_1",
      centerXMm: 1.1 * scale.mmPerM,
      centerYMm: 0,
      widthMm: MIN_BOX_WIDTH_MM,
      heightMm: 1,
      rotationDeg: 0,
    });
    const containerWidthMm =
      Math.max(scale.planWidthMm, box.maxXMm) - Math.min(0, box.minXMm);

    // Reálná rezerva, ne poslední platná číslice: přesah je jednostranný
    // (jen doleva), takže kontejneru zůstává ~4 mm místa navíc, ne 0.
    expect(containerWidthMm).toBeLessThan(AREA.widthMm);
    expect(AREA.widthMm - containerWidthMm).toBeGreaterThan(1);
  });

  it("does not reserve growth room when every zone is already wide enough", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [block({ widthM: 6 })],
      area: AREA,
      minBoxWidthMm: MIN_BOX_WIDTH_MM,
    });

    // Zóna 6 m dá při 13,108 mm/m 78,6 mm, tedy víc než minimum — roste jen tolerance:
    // 162,5375 / (12 + 0,4) = 13,1079 mm/m
    expect(scale.mmPerM).toBeCloseTo(13.1079, 3);
  });

  it("falls back to the tolerance-only scale for an empty layout", () => {
    const scale = resolvePrintScale({
      stage: null,
      blocks: [],
      area: AREA,
      minBoxWidthMm: MIN_BOX_WIDTH_MM,
    });

    expect(scale.mmPerM).toBeCloseTo(13.1079, 3);
  });

  it("binds on height for a deep stage", () => {
    const scale = resolvePrintScale({
      stage: { widthM: 8, depthM: 14 },
      blocks: [block({ widthM: 6 })],
      area: AREA,
      minBoxWidthMm: MIN_BOX_WIDTH_MM,
    });

    // Výška: 202,0914 / (14 + 0,4) = 14,0341; šířka: 162,5375 / 8,4 = 19,35 → váže výška.
    expect(scale.mmPerM).toBeCloseTo(14.0341, 3);
  });

  it("never returns a scale larger than the unreserved one", () => {
    const reserved = resolvePrintScale({
      stage: null,
      blocks: [block()],
      area: AREA,
      minBoxWidthMm: MIN_BOX_WIDTH_MM,
    });

    // Nereservovaný nominál: min(162,5375 / 12, 202,0914 / 8) = 13,5448 mm/m.
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
      minBoxWidthMm: MIN_BOX_WIDTH_MM,
    });

    expect(scale.toM(scale.toMm(3.75))).toBeCloseTo(3.75, 6);
  });
});
