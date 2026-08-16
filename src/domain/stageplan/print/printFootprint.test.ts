import { describe, expect, it } from "vitest";
import {
  type PrintTypography,
  computePrintFootprintMm,
} from "./printFootprint.js";

/** Skutečná tisková typografie strany 2 — 8 pt je dnešní dolní řada. */
const TYPOGRAPHY: PrintTypography = {
  fontSizePt: 8,
  lineHeight: 1.25,
  roleFontSizePt: 7.2,
  roleTrackingEm: 0.14,
  titleGapPt: 6,
  padBottomPt: 2,
  minBoxWidthMm: 36.2594,
};

/** Nominální pódium 12 × 8 m na ploše 162,5375 mm. */
const MM_PER_M = 13.5448;

describe("computePrintFootprintMm", () => {
  it("grows the drums box beyond its zone because the text needs the room", () => {
    const footprint = computePrintFootprintMm({
      lineCount: 8,
      hasPower: true,
      zone: { widthM: 2.8, depthM: 1.6 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    expect(footprint.widthMm).toBeCloseTo(37.925, 2);
    // Zóna dá 21,67 mm, text potřebuje 40,22 mm — vítězí text (R1).
    expect(footprint.heightMm).toBeCloseTo(40.217, 2);
  });

  it("lifts a narrow zone to the minimum readable width", () => {
    const footprint = computePrintFootprintMm({
      lineCount: 3,
      hasPower: false,
      zone: { widthM: 2.6, depthM: 1.2 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    // 2,6 m dá 35,22 mm, což je pod prověřenou šířkou 36,26 mm (R3).
    expect(footprint.widthMm).toBeCloseTo(36.2594, 3);
    expect(footprint.heightMm).toBeCloseTo(19.05, 2);
  });

  it("keeps the zone when the text fits inside it", () => {
    const footprint = computePrintFootprintMm({
      lineCount: 1,
      hasPower: false,
      zone: { widthM: 2.8, depthM: 1.6 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    expect(footprint.heightMm).toBeCloseTo(21.672, 2);
  });

  it("skips the gap below the header when the box has no bullets", () => {
    const footprint = computePrintFootprintMm({
      lineCount: 0,
      hasPower: false,
      zone: { widthM: 0.1, depthM: 0.1 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    // titleGap + hlavička + padBottom, žádná mezera pod hlavičkou.
    expect(footprint.heightMm).toBeCloseTo(6.35, 2);
  });

  it("counts the power line in the height", () => {
    const withPower = computePrintFootprintMm({
      lineCount: 2,
      hasPower: true,
      zone: { widthM: 0.1, depthM: 0.1 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });
    const withoutPower = computePrintFootprintMm({
      lineCount: 2,
      hasPower: false,
      zone: { widthM: 0.1, depthM: 0.1 },
      mmPerM: MM_PER_M,
      typography: TYPOGRAPHY,
    });

    expect(withPower.heightMm - withoutPower.heightMm).toBeCloseTo(3.5278, 3);
  });
});
