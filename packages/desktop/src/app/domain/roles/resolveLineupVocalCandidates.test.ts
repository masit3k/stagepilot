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
      presetCatalog: {
        vocal_no_mic: {
          type: "preset",
          id: "vocal_no_mic",
          label: "Vocal",
          group: "vocs",
          capabilities: ["vocal", "lead_vocal", "back_vocal"],
          inputs: [],
        },
        vocal_wireless: {
          type: "preset",
          id: "vocal_wireless",
          label: "Vocal",
          group: "vocs",
          capabilities: ["vocal", "lead_vocal", "back_vocal"],
          inputs: [],
        },
      },
    });

    expect(candidates).toEqual([
      {
        id: "keys-1",
        name: "Keys Player",
        primaryGroup: "keys",
        hasLeadVocalPreset: true,
        hasBackVocalPreset: true,
        hasVocalCapability: true,
        sectionByRole: { lead: "suggested", back: "suggested" },
        reasonByRole: {
          lead: "lead_vocal_capability",
          back: "back_vocal_capability",
        },
      },
      {
        id: "voc-only",
        name: "Vocal Only",
        primaryGroup: "vocs",
        hasLeadVocalPreset: true,
        hasBackVocalPreset: true,
        hasVocalCapability: true,
        sectionByRole: { lead: "suggested", back: "suggested" },
        reasonByRole: {
          lead: "lead_vocal_capability",
          back: "back_vocal_capability",
        },
      },
    ]);
  });
});
