import { describe, expect, it } from "vitest";
import { normalizeStageplanLayout } from "./normalizeLayout.js";

describe("normalizeStageplanLayout", () => {
  it("keeps a well formed layout", () => {
    const layout = normalizeStageplanLayout({
      stage: { widthM: 10, depthM: 6 },
      blocks: [
        {
          slot: "drums",
          centerXM: 5,
          centerYM: 1.2,
          widthM: 2.8,
          depthM: 1.6,
          rotationDeg: 15,
        },
      ],
    });

    expect(layout).toEqual({
      stage: { widthM: 10, depthM: 6 },
      blocks: [
        {
          slot: "drums",
          centerXM: 5,
          centerYM: 1.2,
          widthM: 2.8,
          depthM: 1.6,
          rotationDeg: 15,
        },
      ],
    });
  });

  it("drops blocks with an unknown slot", () => {
    const layout = normalizeStageplanLayout({
      stage: null,
      blocks: [
        {
          slot: "trombone",
          centerXM: 1,
          centerYM: 1,
          widthM: 1,
          depthM: 1,
          rotationDeg: 0,
        },
        {
          slot: "bass",
          centerXM: 1,
          centerYM: 1,
          widthM: 1,
          depthM: 1,
          rotationDeg: 0,
        },
      ],
    });

    expect(layout?.blocks.map((block) => block.slot)).toEqual(["bass"]);
  });

  it("keeps the first block of a duplicated slot", () => {
    const layout = normalizeStageplanLayout({
      blocks: [
        {
          slot: "keys",
          centerXM: 2,
          centerYM: 2,
          widthM: 2.8,
          depthM: 1.4,
          rotationDeg: 0,
        },
        {
          slot: "keys",
          centerXM: 9,
          centerYM: 5,
          widthM: 2.8,
          depthM: 1.4,
          rotationDeg: 0,
        },
      ],
    });

    expect(layout?.blocks).toHaveLength(1);
    expect(layout?.blocks[0]?.centerXM).toBe(2);
  });

  it("drops blocks with non numeric or non finite values", () => {
    const layout = normalizeStageplanLayout({
      blocks: [
        {
          slot: "drums",
          centerXM: "5",
          centerYM: 1,
          widthM: 2.8,
          depthM: 1.6,
          rotationDeg: 0,
        },
        {
          slot: "bass",
          centerXM: Number.POSITIVE_INFINITY,
          centerYM: 1,
          widthM: 2.7,
          depthM: 1.4,
          rotationDeg: 0,
        },
        {
          slot: "guitar",
          centerXM: 1,
          centerYM: 1,
          widthM: 0,
          depthM: 1.4,
          rotationDeg: 0,
        },
        {
          slot: "keys",
          centerXM: 1,
          centerYM: 1,
          widthM: 2.8,
          depthM: -1,
          rotationDeg: 0,
        },
      ],
    });

    expect(layout?.blocks).toEqual([]);
  });

  it("normalizes rotation into 0-359 whole degrees", () => {
    const layout = normalizeStageplanLayout({
      blocks: [
        {
          slot: "drums",
          centerXM: 1,
          centerYM: 1,
          widthM: 2.8,
          depthM: 1.6,
          rotationDeg: -45.4,
        },
        {
          slot: "bass",
          centerXM: 1,
          centerYM: 1,
          widthM: 2.7,
          depthM: 1.4,
          rotationDeg: 375,
        },
      ],
    });

    expect(layout?.blocks.map((block) => block.rotationDeg)).toEqual([315, 15]);
  });

  it("rejects a stage size with a non positive dimension", () => {
    const layout = normalizeStageplanLayout({
      stage: { widthM: 12, depthM: 0 },
      blocks: [],
    });
    expect(layout?.stage).toBeNull();
  });

  it("returns undefined when blocks are missing entirely", () => {
    expect(normalizeStageplanLayout(undefined)).toBeUndefined();
    expect(
      normalizeStageplanLayout({ stage: { widthM: 12, depthM: 8 } }),
    ).toBeUndefined();
  });
});
