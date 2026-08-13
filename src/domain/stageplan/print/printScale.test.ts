import { describe, expect, it } from "vitest";
import type { StageplanBlock } from "../../model/types.js";
import { createPrintScale, resolvePrintScale } from "./printScale.js";

/** Skutečná tisková plocha strany 2 — stejná čísla, s jakými počítá renderer. */
const AREA = { widthMm: 162.5375, heightMm: 202.0914 };
const MIN_BOX_WIDTH_MM = 36.2594;

describe("createPrintScale", () => {
  it("uses the nominal stage when the size is not entered", () => {
    const scale = createPrintScale(null, AREA);

    expect(scale.mmPerM).toBeCloseTo(13.5448, 3);
    expect(scale.planWidthMm).toBeCloseTo(162.5375, 3);
    expect(scale.planHeightMm).toBeCloseTo(108.3583, 3);
  });

  it("binds on width for a stage wider than deep", () => {
    const scale = createPrintScale({ widthM: 10, depthM: 6 }, AREA);

    expect(scale.mmPerM).toBeCloseTo(16.2538, 3);
    expect(scale.planWidthMm).toBeCloseTo(162.5375, 3);
    expect(scale.planHeightMm).toBeCloseTo(97.5225, 3);
  });

  it("binds on height for a stage deeper than 1,243 times its width", () => {
    const scale = createPrintScale({ widthM: 8, depthM: 14 }, AREA);

    expect(scale.mmPerM).toBeCloseTo(14.4351, 3);
    expect(scale.planHeightMm).toBeCloseTo(202.0914, 3);
    expect(scale.planWidthMm).toBeCloseTo(115.4808, 3);
  });

  it("round-trips metres through millimetres", () => {
    const scale = createPrintScale({ widthM: 11, depthM: 7 }, AREA);

    expect(scale.toM(scale.toMm(3.75))).toBeCloseTo(3.75, 6);
  });
});

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

    // Střed 1,1 m mínus půlka minimální šířky boxu musí zůstat nad −(rezerva).
    const leftEdgeMm = 1.1 * scale.mmPerM - MIN_BOX_WIDTH_MM / 2;
    const rightEdgeMm = scale.planWidthMm - leftEdgeMm;
    expect(rightEdgeMm - leftEdgeMm).toBeLessThanOrEqual(AREA.widthMm);
    expect(leftEdgeMm).toBeGreaterThan(-(AREA.widthMm - scale.planWidthMm) / 2);
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

    expect(reserved.mmPerM).toBeLessThan(createPrintScale(null, AREA).mmPerM);
  });
});
