import { describe, expect, it } from "vitest";
import { resolveLineupVocalCandidates } from "./resolveLineupVocalCandidates";

const VOCAL_NO_MIC_PRESET = {
  type: "preset" as const,
  id: "vocal_no_mic",
  label: "Vocal (no mic)",
  group: "vocs",
  capabilities: ["vocal", "back_vocal"] as ["vocal", "back_vocal"],
  inputs: [],
};

const VOCAL_WIRELESS_PRESET = {
  type: "preset" as const,
  id: "vocal_wireless",
  label: "Vocal (wireless)",
  group: "vocs",
  capabilities: ["vocal", "lead_vocal", "back_vocal"] as [
    "vocal",
    "lead_vocal",
    "back_vocal",
  ],
  inputs: [],
};

describe("resolveLineupVocalCandidates", () => {
  it("vocal_no_mic does not provide lead_vocal — musician goes to additional for lead", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-no-mic",
          firstName: "Vocal",
          lastName: "NoMic",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      lineupMembers: [{ id: "voc-no-mic", name: "Vocal NoMic" }],
      presetCatalog: { vocal_no_mic: VOCAL_NO_MIC_PRESET },
    });

    expect(candidates[0].sectionByRole.lead).toBe("additional");
    expect(candidates[0].hasLeadVocalPreset).toBe(false);
  });

  it("vocal_no_mic provides back_vocal — musician goes to suggested for back", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-no-mic",
          firstName: "Vocal",
          lastName: "NoMic",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      lineupMembers: [{ id: "voc-no-mic", name: "Vocal NoMic" }],
      presetCatalog: { vocal_no_mic: VOCAL_NO_MIC_PRESET },
    });

    expect(candidates[0].sectionByRole.back).toBe("suggested");
    expect(candidates[0].hasBackVocalPreset).toBe(true);
  });

  it("vocal_wireless provides lead_vocal — musician goes to suggested for lead", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-1",
          firstName: "Lead",
          lastName: "Singer",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_wireless" }],
        },
      ],
      lineupMembers: [{ id: "voc-1", name: "Lead Singer" }],
      presetCatalog: { vocal_wireless: VOCAL_WIRELESS_PRESET },
    });

    expect(candidates[0].sectionByRole.lead).toBe("suggested");
    expect(candidates[0].hasLeadVocalPreset).toBe(true);
  });

  it("instrumentalist with only vocal_no_mic is not suggested for lead but is suggested for back", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "keys-1",
          firstName: "Keys",
          lastName: "Player",
          group: "keys",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      lineupMembers: [{ id: "keys-1", name: "Keys Player" }],
      presetCatalog: { vocal_no_mic: VOCAL_NO_MIC_PRESET },
    });

    expect(candidates[0].sectionByRole.lead).toBe("additional");
    expect(candidates[0].sectionByRole.back).toBe("suggested");
  });

  it("returns candidates from full lineup with mixed preset types", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-no-mic",
          firstName: "Vocal",
          lastName: "NoMic",
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
        { id: "voc-no-mic", name: "Vocal NoMic" },
        { id: "keys-1", name: "Keys Player" },
      ],
      presetCatalog: {
        vocal_no_mic: VOCAL_NO_MIC_PRESET,
        vocal_wireless: VOCAL_WIRELESS_PRESET,
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
        id: "voc-no-mic",
        name: "Vocal NoMic",
        primaryGroup: "vocs",
        hasLeadVocalPreset: false,
        hasBackVocalPreset: true,
        hasVocalCapability: true,
        sectionByRole: { lead: "additional", back: "suggested" },
        reasonByRole: {
          lead: "active_lineup_without_vocal_preset",
          back: "back_vocal_capability",
        },
      },
    ]);
  });
});
