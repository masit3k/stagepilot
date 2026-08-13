import { describe, expect, it } from "vitest";
import { NOMINAL_STAGE, buildDefaultLayout } from "./defaultLayout.js";

const FIVE = ["drums", "bass", "guitar", "keys", "lead_voc_1"] as const;
const SIX = [...FIVE, "lead_voc_2"] as const;

describe("buildDefaultLayout", () => {
  it("mirrors today's print layout for five blocks", () => {
    const layout = buildDefaultLayout({ slots: FIVE, stage: null });

    expect(layout.stage).toBeNull();
    expect(
      layout.blocks.map((block) => [
        block.slot,
        block.centerXM,
        block.centerYM,
      ]),
    ).toEqual([
      ["drums", 6, 1.2],
      ["bass", 9.4, 1.2],
      ["guitar", 2.6, 5.5],
      ["keys", 9.4, 5.5],
      ["lead_voc_1", 6, 5.5],
    ]);
  });

  it("uses the four column bottom row when a second lead vocal exists", () => {
    const layout = buildDefaultLayout({ slots: SIX, stage: null });
    const centers = new Map(
      layout.blocks.map((block) => [block.slot, block.centerXM]),
    );

    expect(centers.get("guitar")).toBe(1.5);
    expect(centers.get("lead_voc_1")).toBe(4.5);
    expect(centers.get("lead_voc_2")).toBe(7.5);
    expect(centers.get("keys")).toBe(10.5);
  });

  it("gives every slot its zone size and no rotation", () => {
    const layout = buildDefaultLayout({ slots: FIVE, stage: null });
    const drums = layout.blocks.find((block) => block.slot === "drums");

    expect(drums).toMatchObject({ widthM: 2.8, depthM: 1.6, rotationDeg: 0 });
    expect(layout.blocks.every((block) => block.rotationDeg === 0)).toBe(true);
  });

  it("scales the nominal centres onto a smaller stage but keeps zone sizes", () => {
    const layout = buildDefaultLayout({
      slots: FIVE,
      stage: { widthM: 6, depthM: 4 },
    });
    const drums = layout.blocks.find((block) => block.slot === "drums");

    expect(drums?.centerXM).toBe(3);
    expect(drums?.centerYM).toBe(0.6);
    expect(drums?.widthM).toBe(2.8);
  });

  it("keeps only the requested slots and ignores their input order", () => {
    const layout = buildDefaultLayout({
      slots: ["lead_voc_1", "drums"],
      stage: null,
    });

    expect(layout.blocks.map((block) => block.slot)).toEqual([
      "drums",
      "lead_voc_1",
    ]);
  });

  it("returns an empty layout for an empty lineup", () => {
    expect(buildDefaultLayout({ slots: [], stage: null }).blocks).toEqual([]);
  });

  it("is deterministic", () => {
    expect(buildDefaultLayout({ slots: SIX, stage: null })).toEqual(
      buildDefaultLayout({ slots: SIX, stage: null }),
    );
  });

  it("draws a project without a stage size on the nominal area", () => {
    expect(NOMINAL_STAGE).toEqual({ widthM: 12, depthM: 8 });
  });
});
