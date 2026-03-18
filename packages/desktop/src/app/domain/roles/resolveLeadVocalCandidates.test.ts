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

    expect(
      result.suggestedLeadVocalCandidates.map((item) => item.musicianId),
    ).toEqual(["keys-1", "drm-1"]);
    expect(
      result.otherLeadVocalCandidates.map((item) => item.musicianId),
    ).toEqual(["voc-1", "gtr-1"]);
  });

  it("keeps selected non-suggested candidates in other section without duplication", () => {
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

    expect(result.suggestedLeadVocalCandidates).toHaveLength(0);
    expect(result.otherLeadVocalCandidates).toHaveLength(1);
    expect(result.otherLeadVocalCandidates[0]).toMatchObject({
      musicianId: "m1",
      isSelected: true,
      isSuggested: false,
    });
  });

  it("treats default suggested lead vocal ids as suggested even without lead preset", () => {
    const result = resolveLeadVocalCandidates({
      lineupCandidates: [
        {
          musicianId: "m1",
          displayName: "One",
          primaryGroup: "keys",
          hasLeadVocalPreset: false,
        },
      ],
      selectedLeadVocalistIds: [],
      suggestedLeadVocalistIds: ["m1"],
    });

    expect(result.suggestedLeadVocalCandidates.map((item) => item.musicianId)).toEqual(["m1"]);
    expect(result.otherLeadVocalCandidates).toHaveLength(0);
  });
});
