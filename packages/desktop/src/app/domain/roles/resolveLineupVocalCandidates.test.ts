import { describe, expect, it } from "vitest";
import { resolveLineupVocalCandidates } from "./resolveLineupVocalCandidates";

describe("resolveLineupVocalCandidates", () => {
  it("returns candidates from full lineup including vocal-only members", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-only",
          firstName: "Vocal",
          lastName: "Only",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
        {
          id: "keys-1",
          firstName: "Keys",
          lastName: "Player",
          group: "keys",
          presets: [{ kind: "preset", ref: "vocal_wireless" }],
        },
      ],
      lineupMembers: [
        { id: "voc-only", name: "Vocal Only" },
        { id: "keys-1", name: "Keys Player" },
      ],
    });

    expect(candidates).toEqual([
      {
        id: "keys-1",
        name: "Keys Player",
        primaryGroup: "keys",
        hasLeadVocalPreset: true,
        hasBackVocalPreset: true,
      },
      {
        id: "voc-only",
        name: "Vocal Only",
        primaryGroup: "vocs",
        hasLeadVocalPreset: true,
        hasBackVocalPreset: true,
      },
    ]);
  });
});
