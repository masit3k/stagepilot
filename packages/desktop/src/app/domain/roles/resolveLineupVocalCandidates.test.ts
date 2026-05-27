import { describe, expect, it } from "vitest";
import { resolveLineupVocalCandidates } from "./resolveLineupVocalCandidates";

const VOCAL_PRESET = {
  type: "preset" as const,
  id: "vocal_no_mic",
  label: "Vocal (no mic)",
  group: "vocs",
  capabilities: ["vocal"] as ["vocal"],
  inputs: [],
};

describe("resolveLineupVocalCandidates", () => {
  it("vocs musician with vocal preset is suggested for both lead and back", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-1",
          firstName: "Lead",
          lastName: "Singer",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      lineupMembers: [{ id: "voc-1", name: "Lead Singer" }],
      presetCatalog: { vocal_no_mic: VOCAL_PRESET },
    });

    expect(candidates[0].sectionByRole.lead).toBe("suggested");
    expect(candidates[0].sectionByRole.back).toBe("suggested");
    expect(candidates[0].hasVocalCapability).toBe(true);
  });

  it("instrumentalist with vocal preset is additional for lead but suggested for back", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "bass-1",
          firstName: "Bass",
          lastName: "Player",
          group: "bass",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      lineupMembers: [{ id: "bass-1", name: "Bass Player" }],
      presetCatalog: { vocal_no_mic: VOCAL_PRESET },
    });

    expect(candidates[0].sectionByRole.lead).toBe("additional");
    expect(candidates[0].sectionByRole.back).toBe("suggested");
    expect(candidates[0].hasVocalCapability).toBe(true);
  });

  it("musician without vocal preset is additional for both lead and back", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "drums-1",
          firstName: "Drum",
          lastName: "Player",
          group: "drums",
          presets: [],
        },
      ],
      lineupMembers: [{ id: "drums-1", name: "Drum Player" }],
      presetCatalog: {},
    });

    expect(candidates[0].sectionByRole.lead).toBe("additional");
    expect(candidates[0].sectionByRole.back).toBe("additional");
    expect(candidates[0].hasVocalCapability).toBe(false);
  });

  it("returns candidates sorted by group order then name", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-1",
          firstName: "Vocal",
          lastName: "One",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
        {
          id: "keys-1",
          firstName: "Keys",
          lastName: "Player",
          group: "keys",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      lineupMembers: [
        { id: "voc-1", name: "Vocal One" },
        { id: "keys-1", name: "Keys Player" },
      ],
      presetCatalog: { vocal_no_mic: VOCAL_PRESET },
    });

    expect(candidates.map((c) => c.id)).toEqual(["keys-1", "voc-1"]);
  });

  it("mixed lineup: vocs suggested for lead, instrumentalist additional for lead", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-1",
          firstName: "Vocalist",
          lastName: "A",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
        {
          id: "keys-1",
          firstName: "Keys",
          lastName: "Player",
          group: "keys",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
        {
          id: "drums-1",
          firstName: "Drums",
          lastName: "Player",
          group: "drums",
          presets: [],
        },
      ],
      lineupMembers: [
        { id: "voc-1", name: "Vocalist A" },
        { id: "keys-1", name: "Keys Player" },
        { id: "drums-1", name: "Drums Player" },
      ],
      presetCatalog: { vocal_no_mic: VOCAL_PRESET },
    });

    const voc = candidates.find((c) => c.id === "voc-1")!;
    const keys = candidates.find((c) => c.id === "keys-1")!;
    const drums = candidates.find((c) => c.id === "drums-1")!;

    expect(voc.sectionByRole.lead).toBe("suggested");
    expect(voc.sectionByRole.back).toBe("suggested");

    expect(keys.sectionByRole.lead).toBe("additional");
    expect(keys.sectionByRole.back).toBe("suggested");

    expect(drums.sectionByRole.lead).toBe("additional");
    expect(drums.sectionByRole.back).toBe("additional");
  });
});
