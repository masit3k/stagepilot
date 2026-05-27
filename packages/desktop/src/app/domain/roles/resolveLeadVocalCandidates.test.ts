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
          section: "suggested",
          reason: "vocal_capability",
        },
        {
          musicianId: "voc-1",
          displayName: "Adam",
          primaryGroup: "vocs",
          section: "additional",
          reason: "active_lineup_without_vocal_preset",
        },
        {
          musicianId: "gtr-1",
          displayName: "Boris",
          primaryGroup: "guitar",
          section: "additional",
          reason: "active_lineup_without_vocal_preset",
        },
        {
          musicianId: "drm-1",
          displayName: "David",
          primaryGroup: "drums",
          section: "suggested",
          reason: "vocal_capability",
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
          section: "additional",
          reason: "active_lineup_without_vocal_preset",
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

  it("uses candidate section as the only suggested grouping source", () => {
    const result = resolveLeadVocalCandidates({
      lineupCandidates: [
        {
          musicianId: "m1",
          displayName: "One",
          primaryGroup: "keys",
          section: "suggested",
          reason: "vocal_capability",
        },
      ],
      selectedLeadVocalistIds: [],
    });

    expect(
      result.suggestedLeadVocalCandidates.map((item) => item.musicianId),
    ).toEqual(["m1"]);
    expect(result.otherLeadVocalCandidates).toHaveLength(0);
  });
});
