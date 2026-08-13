import { describe, expect, it } from "vitest";
import { createStageScale } from "./scale.js";

const AREA = { widthM: 12, depthM: 8 };

describe("createStageScale", () => {
  it("fits the area into the viewport without distorting it", () => {
    const scale = createStageScale(AREA, { widthPx: 1200, heightPx: 600 });

    expect(scale.pxPerM).toBe(75);
    expect(scale.widthPx).toBe(900);
    expect(scale.heightPx).toBe(600);
  });

  it("is limited by width when the viewport is tall", () => {
    const scale = createStageScale(AREA, { widthPx: 600, heightPx: 2000 });

    expect(scale.pxPerM).toBe(50);
  });

  it("round trips metres through pixels", () => {
    const scale = createStageScale(AREA, { widthPx: 1000, heightPx: 700 });

    expect(scale.toM(scale.toPx(4.237))).toBeCloseTo(4.237, 6);
  });

  it("never returns a zero or negative scale for a collapsed viewport", () => {
    const scale = createStageScale(AREA, { widthPx: 0, heightPx: 0 });

    expect(scale.pxPerM).toBeGreaterThan(0);
  });
});
