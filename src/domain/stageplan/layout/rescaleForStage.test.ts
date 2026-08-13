import { describe, expect, it } from "vitest";
import type { StageplanLayout } from "../../model/types.js";
import { rescaleForStage } from "./rescaleForStage.js";

const NOMINAL_LAYOUT: StageplanLayout = {
  stage: null,
  blocks: [
    {
      slot: "drums",
      centerXM: 6,
      centerYM: 1.2,
      widthM: 2.8,
      depthM: 1.6,
      rotationDeg: 0,
    },
    {
      slot: "keys",
      centerXM: 9.4,
      centerYM: 5.5,
      widthM: 2.8,
      depthM: 1.4,
      rotationDeg: 0,
    },
  ],
};

describe("rescaleForStage", () => {
  it("scales centres proportionally from the nominal area", () => {
    const rescaled = rescaleForStage(NOMINAL_LAYOUT, { widthM: 6, depthM: 4 });

    expect(rescaled.blocks[0]).toMatchObject({ centerXM: 3, centerYM: 0.6 });
  });

  it("keeps zone sizes — a drummer needs the same space on any stage", () => {
    const rescaled = rescaleForStage(NOMINAL_LAYOUT, { widthM: 6, depthM: 4 });

    expect(rescaled.blocks.map((block) => block.widthM)).toEqual([2.8, 2.8]);
  });

  it("stores the new stage size", () => {
    expect(
      rescaleForStage(NOMINAL_LAYOUT, { widthM: 10, depthM: 6 }).stage,
    ).toEqual({
      widthM: 10,
      depthM: 6,
    });
  });

  it("scales back onto the nominal area when the size is cleared", () => {
    const sized = rescaleForStage(NOMINAL_LAYOUT, { widthM: 6, depthM: 4 });
    const cleared = rescaleForStage(sized, null);

    expect(cleared.stage).toBeNull();
    expect(cleared.blocks[0]?.centerXM).toBeCloseTo(6, 3);
  });

  it("keeps every block on the shrunken area", () => {
    const rescaled = rescaleForStage(NOMINAL_LAYOUT, { widthM: 6, depthM: 4 });

    for (const block of rescaled.blocks) {
      expect(block.centerXM).toBeLessThanOrEqual(6);
      expect(block.centerYM).toBeLessThanOrEqual(4);
    }
  });
});
