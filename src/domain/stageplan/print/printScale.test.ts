import { describe, expect, it } from "vitest";
import { createPrintScale } from "./printScale.js";

/** Skutečná tisková plocha strany 2 — stejná čísla, s jakými počítá renderer. */
const AREA = { widthMm: 162.5375, heightMm: 202.0914 };

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
