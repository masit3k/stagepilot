import { describe, expect, it } from "vitest";
import { resolveStageplanBlockSlots } from "./resolveBlockSlots.js";

describe("resolveStageplanBlockSlots", () => {
  it("gives a slot to every occupied instrument group", () => {
    const slots = resolveStageplanBlockSlots({
      musicianIdsByGroup: {
        drums: ["d1"],
        bass: ["b1"],
        guitar: [],
        keys: ["k1"],
      },
      leadVocalIds: [],
    });

    expect(slots).toEqual(["drums", "bass", "keys"]);
  });

  it("turns the first two free lead vocalists into voc slots", () => {
    const slots = resolveStageplanBlockSlots({
      musicianIdsByGroup: { drums: ["d1"] },
      leadVocalIds: ["v1", "v2", "v3"],
    });

    expect(slots).toEqual(["drums", "lead_voc_1", "lead_voc_2"]);
  });

  it("does not give a voc slot to a lead vocalist who already plays an instrument", () => {
    const slots = resolveStageplanBlockSlots({
      musicianIdsByGroup: { keys: ["k1"] },
      leadVocalIds: ["k1"],
    });

    expect(slots).toEqual(["keys"]);
  });

  it("returns an empty list for an empty lineup", () => {
    expect(
      resolveStageplanBlockSlots({ musicianIdsByGroup: {}, leadVocalIds: [] }),
    ).toEqual([]);
  });

  it("keeps the canonical slot order regardless of input order", () => {
    const slots = resolveStageplanBlockSlots({
      musicianIdsByGroup: { keys: ["k1"], drums: ["d1"] },
      leadVocalIds: ["v1"],
    });

    expect(slots).toEqual(["drums", "keys", "lead_voc_1"]);
  });
});
