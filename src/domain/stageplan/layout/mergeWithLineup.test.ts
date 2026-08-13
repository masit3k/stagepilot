import { describe, expect, it } from "vitest";
import type { StageplanLayout } from "../../model/types.js";
import { mergeWithLineup } from "./mergeWithLineup.js";

const MOVED: StageplanLayout = {
  stage: { widthM: 10, depthM: 6 },
  blocks: [
    {
      slot: "drums",
      centerXM: 1.5,
      centerYM: 4.2,
      widthM: 2.8,
      depthM: 1.6,
      rotationDeg: 45,
    },
    {
      slot: "bass",
      centerXM: 8,
      centerYM: 1,
      widthM: 2.7,
      depthM: 1.4,
      rotationDeg: 0,
    },
  ],
};

describe("mergeWithLineup", () => {
  it("builds the default layout when nothing exists yet", () => {
    const merged = mergeWithLineup(undefined, {
      slots: ["drums", "bass"],
      stage: null,
    });

    expect(merged.blocks.map((block) => block.slot)).toEqual(["drums", "bass"]);
    expect(merged.blocks[0]?.centerXM).toBe(6);
  });

  it("never rewrites a hand placed block", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["drums", "bass"],
      stage: null,
    });

    expect(merged.blocks.find((block) => block.slot === "drums")).toEqual(
      MOVED.blocks[0],
    );
  });

  it("adds a new slot at its default position", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["drums", "bass", "lead_voc_1"],
      stage: null,
    });
    const lead = merged.blocks.find((block) => block.slot === "lead_voc_1");

    expect(lead).toMatchObject({ widthM: 2.6, depthM: 1.2, rotationDeg: 0 });
    expect(lead?.centerXM).not.toBe(0);
  });

  it("removes blocks whose slot left the lineup", () => {
    const merged = mergeWithLineup(MOVED, { slots: ["drums"], stage: null });

    expect(merged.blocks.map((block) => block.slot)).toEqual(["drums"]);
  });

  it("keeps the stage size of the existing layout", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["drums", "bass"],
      stage: null,
    });

    expect(merged.stage).toEqual({ widthM: 10, depthM: 6 });
  });

  it("places a new slot on the existing stage, not on the nominal one", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["drums", "bass", "keys"],
      stage: null,
    });
    const keys = merged.blocks.find((block) => block.slot === "keys");

    // 9,4 m z dvanácti nominálních přepočteno na desetimetrové pódium.
    expect(keys?.centerXM).toBeCloseTo(7.833, 3);
  });

  it("keeps the canonical slot order after a merge", () => {
    const merged = mergeWithLineup(MOVED, {
      slots: ["lead_voc_1", "bass", "drums"],
      stage: null,
    });

    expect(merged.blocks.map((block) => block.slot)).toEqual([
      "drums",
      "bass",
      "lead_voc_1",
    ]);
  });
});
