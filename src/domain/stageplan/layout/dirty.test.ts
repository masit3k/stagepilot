import { describe, expect, it } from "vitest";
import type { StageplanLayout } from "../../model/types.js";
import { isStageplanLayoutDirty } from "./dirty.js";

const LAYOUT: StageplanLayout = {
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
      slot: "bass",
      centerXM: 9.4,
      centerYM: 1.2,
      widthM: 2.7,
      depthM: 1.4,
      rotationDeg: 0,
    },
  ],
};

describe("isStageplanLayoutDirty", () => {
  it("is clean against an identical layout", () => {
    expect(isStageplanLayoutDirty(LAYOUT, { ...LAYOUT })).toBe(false);
  });

  it("ignores block order", () => {
    const reordered: StageplanLayout = {
      stage: LAYOUT.stage,
      blocks: [...LAYOUT.blocks].reverse(),
    };

    expect(isStageplanLayoutDirty(LAYOUT, reordered)).toBe(false);
  });

  it("ignores rounding noise below a millimetre", () => {
    const noisy: StageplanLayout = {
      stage: LAYOUT.stage,
      blocks: LAYOUT.blocks.map((block) => ({
        ...block,
        centerXM: block.centerXM + 0.00004,
      })),
    };

    expect(isStageplanLayoutDirty(LAYOUT, noisy)).toBe(false);
  });

  it("sees a moved block", () => {
    const moved: StageplanLayout = {
      stage: LAYOUT.stage,
      blocks: LAYOUT.blocks.map((block, index) =>
        index === 0 ? { ...block, centerXM: 5.9 } : block,
      ),
    };

    expect(isStageplanLayoutDirty(LAYOUT, moved)).toBe(true);
  });

  it("sees a rotated block, a changed stage size and a removed block", () => {
    expect(
      isStageplanLayoutDirty(LAYOUT, {
        stage: LAYOUT.stage,
        blocks: LAYOUT.blocks.map((block, index) =>
          index === 0 ? { ...block, rotationDeg: 15 } : block,
        ),
      }),
    ).toBe(true);
    expect(
      isStageplanLayoutDirty(LAYOUT, {
        stage: { widthM: 10, depthM: 6 },
        blocks: LAYOUT.blocks,
      }),
    ).toBe(true);
    expect(
      isStageplanLayoutDirty(LAYOUT, {
        stage: LAYOUT.stage,
        blocks: LAYOUT.blocks.slice(0, 1),
      }),
    ).toBe(true);
  });

  it("treats a missing initial layout as dirty once blocks exist", () => {
    expect(isStageplanLayoutDirty(undefined, LAYOUT)).toBe(true);
  });
});
