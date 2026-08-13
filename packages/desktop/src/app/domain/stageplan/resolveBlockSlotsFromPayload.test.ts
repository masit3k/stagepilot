import { describe, expect, it } from "vitest";
import { resolveBlockSlotsFromPayload } from "./resolveBlockSlotsFromPayload";

describe("resolveBlockSlotsFromPayload", () => {
  it("reads plain string lineup entries", () => {
    const slots = resolveBlockSlotsFromPayload({
      lineup: { drums: "d1", bass: "b1" },
      overlays: { leadVocals: ["v1"] },
    });

    expect(slots).toEqual(["drums", "bass", "lead_voc_1"]);
  });

  it("reads array and object lineup entries", () => {
    const slots = resolveBlockSlotsFromPayload({
      lineup: { keys: [{ musicianId: "k1" }], guitar: ["g1", "g2"] },
    });

    expect(slots).toEqual(["guitar", "keys"]);
  });

  it("falls back to lineup vocs when there is no lead vocal overlay", () => {
    const slots = resolveBlockSlotsFromPayload({
      lineup: { drums: "d1", vocs: ["v1", "v2"] },
    });

    expect(slots).toEqual(["drums", "lead_voc_1", "lead_voc_2"]);
  });

  it("ignores empty and blank entries", () => {
    const slots = resolveBlockSlotsFromPayload({
      lineup: { drums: "", bass: [], keys: "k1" },
    });

    expect(slots).toEqual(["keys"]);
  });

  it("returns nothing for a project without a lineup", () => {
    expect(resolveBlockSlotsFromPayload({})).toEqual([]);
  });
});
