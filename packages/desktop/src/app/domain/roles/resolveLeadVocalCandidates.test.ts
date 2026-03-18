import { describe, expect, it } from "vitest";
import { resolveLeadVocalCandidates } from "./resolveLeadVocalCandidates";

describe("resolveLeadVocalCandidates", () => {
  it("builds suggested and other sections with deterministic ordering", () => {
    const result = resolveLeadVocalCandidates({
      lineupCandidates: [
        {
          musicianId: "keys-1",
          displayName: "Klara",
          primaryGroup: "keys",
          hasLeadVocalPreset: true,
        },
        {
          musicianId: "voc-1",
          displayName: "Adam",
          primaryGroup: "vocs",
          hasLeadVocalPreset: false,
        },
        {
          musicianId: "gtr-1",
          displayName: "Boris",
          primaryGroup: "guitar",
          hasLeadVocalPreset: false,
        },
        {
          musicianId: "drm-1",
          displayName: "David",
          primaryGroup: "drums",
          hasLeadVocalPreset: true,
        },
      ],
      selectedLeadVocalistIds: ["voc-1", "keys-1"],
    });

    expect(result.suggestedLeadVocalCandidates.map((item) => item.musicianId)).toEqual([
      "keys-1",
      "voc-1",
      "drm-1",
    ]);
    expect(result.otherLeadVocalCandidates.map((item) => item.musicianId)).toEqual(["gtr-1"]);
  });

  it("does not duplicate entries across sections", () => {
    const result = resolveLeadVocalCandidates({
      lineupCandidates: [
        {
          musicianId: "m1",
          displayName: "One",
          primaryGroup: "bass",
          hasLeadVocalPreset: false,
        },
      ],
      selectedLeadVocalistIds: ["m1"],
    });

    expect(result.suggestedLeadVocalCandidates).toHaveLength(1);
    expect(result.otherLeadVocalCandidates).toHaveLength(0);
  });
});
