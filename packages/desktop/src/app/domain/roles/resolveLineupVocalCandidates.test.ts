import { describe, expect, it } from "vitest";
import type { PresetEntity } from "../../../../../../src/domain/model/types";
import { resolveLineupVocalCandidates } from "./resolveLineupVocalCandidates";

const VOCAL_PRESET = {
  type: "preset" as const,
  id: "vocal_no_mic",
  label: "Vocal (no mic)",
  group: "vocs",
  capabilities: ["vocal"] as ["vocal"],
  inputs: [],
} satisfies PresetEntity;

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

  it("instrumentalist with vocal preset is other for lead but suggested for back", () => {
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

    expect(candidates[0].sectionByRole.lead).toBe("other_lineup_members");
    expect(candidates[0].sectionByRole.back).toBe("suggested");
    expect(candidates[0].hasVocalCapability).toBe(true);
  });

  it("musician without vocal preset is other for both lead and back", () => {
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

    expect(candidates[0].sectionByRole.lead).toBe("other_lineup_members");
    expect(candidates[0].sectionByRole.back).toBe("other_lineup_members");
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

  it("mixed lineup: vocs suggested for lead, instrumentalist other for lead", () => {
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

    expect(keys.sectionByRole.lead).toBe("other_lineup_members");
    expect(keys.sectionByRole.back).toBe("suggested");

    expect(drums.sectionByRole.lead).toBe("other_lineup_members");
    expect(drums.sectionByRole.back).toBe("other_lineup_members");
  });

  it("suggests catalog-only vocs singers with vocal capability for lead and back", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [],
      lineupMembers: [],
      catalogMusicians: [
        {
          id: "zuzana",
          firstName: "Zuzana",
          lastName: "Mimrova",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      catalogMembers: [{ id: "zuzana", name: "Mimrova Zuzana" }],
      presetCatalog: { vocal_no_mic: VOCAL_PRESET },
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "zuzana",
      source: "band_catalog",
      isInProjectLineup: false,
      sectionByRole: {
        lead: "suggested",
        back: "suggested",
      },
    });
  });

  it("dedupes catalog and lineup candidates with project lineup precedence", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "matej",
          firstName: "Matej",
          lastName: "Krecmer",
          group: "bass",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      lineupMembers: [{ id: "matej", name: "Krecmer Matej" }],
      catalogMusicians: [
        {
          id: "matej",
          firstName: "Matej",
          lastName: "Krecmer",
          group: "bass",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      catalogMembers: [{ id: "matej", name: "Krecmer Matej" }],
      presetCatalog: { vocal_no_mic: VOCAL_PRESET },
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      source: "project_lineup",
      isInProjectLineup: true,
      sectionByRole: {
        lead: "other_lineup_members",
        back: "suggested",
      },
    });
  });

  it("keeps catalog-only vocal-capable instrumentalists for backing vocal suggestions", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [],
      lineupMembers: [],
      catalogMusicians: [
        {
          id: "guest-gtr",
          firstName: "Guest",
          lastName: "Guitar",
          group: "guitar",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
      ],
      catalogMembers: [{ id: "guest-gtr", name: "Guest Guitar" }],
      presetCatalog: { vocal_no_mic: VOCAL_PRESET },
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].sectionByRole).toMatchObject({
      lead: "other_lineup_members",
      back: "suggested",
    });
  });

  it("detects vocal capability through a legacy preset ref resolved via the alias map", () => {
    // "el_bass_xlr" is a pre-existing legacy alias for "el_bass_xlr_amp" (unrelated to
    // monitors). The catalog below only has the canonical id, so this only finds a match
    // if the lookup resolves the alias instead of indexing presetCatalog raw.
    const ALIASED_PRESET = {
      type: "preset" as const,
      id: "el_bass_xlr_amp",
      label: "Electric bass guitar",
      group: "bass" as const,
      capabilities: ["vocal"] as ["vocal"],
      inputs: [],
    } satisfies PresetEntity;

    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "bass-1",
          firstName: "Bass",
          lastName: "Player",
          group: "bass",
          presets: [{ kind: "preset", ref: "el_bass_xlr" }],
        },
      ],
      lineupMembers: [{ id: "bass-1", name: "Bass Player" }],
      presetCatalog: { el_bass_xlr_amp: ALIASED_PRESET },
    });

    expect(candidates[0].hasVocalCapability).toBe(true);
  });

  it("excludes catalog-only non-vocal instrumentalists", () => {
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [],
      lineupMembers: [],
      catalogMusicians: [
        {
          id: "guest-gtr",
          firstName: "Guest",
          lastName: "Guitar",
          group: "guitar",
          presets: [],
        },
      ],
      catalogMembers: [{ id: "guest-gtr", name: "Guest Guitar" }],
      presetCatalog: {},
    });

    expect(candidates).toEqual([]);
  });
});

describe("lead suggestion invariant", () => {
  it("only a vocs musician can ever land in the lead suggested section", () => {
    // Uzamyka implikaci, na ktere stoji filtr v `resolveVocalOverlayEditorModel`:
    // `isLeadSuggested` je `group === "vocs" && hasVocalCapability`, takze
    // `sectionByRole.lead === "suggested"` uz `primaryGroup === "vocs"` obsahuje.
    // Dokud to plati, je klauzule `sectionByRole.lead === "suggested"` v tom
    // filtru mrtva a byla odstranena. Az tuhle implikaci nekdo zrusi, ozve se
    // tenhle test, ne az chybejici kandidat v modalu.
    const candidates = resolveLineupVocalCandidates({
      lineupMusicians: [
        {
          id: "voc-1",
          firstName: "Lead",
          lastName: "Singer",
          group: "vocs",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
        {
          id: "voc-2",
          firstName: "Silent",
          lastName: "Singer",
          group: "vocs",
          presets: [],
        },
        {
          id: "bass-1",
          firstName: "Bass",
          lastName: "Player",
          group: "bass",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
        {
          id: "drums-1",
          firstName: "Drum",
          lastName: "Player",
          group: "drums",
          presets: [],
        },
        {
          id: "keys-1",
          firstName: "Keys",
          lastName: "Player",
          group: "keys",
          presets: [{ kind: "preset", ref: "vocal_no_mic" }],
        },
        {
          id: "gtr-1",
          firstName: "Guitar",
          lastName: "Player",
          group: "guitar",
          presets: [],
        },
      ],
      lineupMembers: [
        { id: "voc-1", name: "Lead Singer" },
        { id: "voc-2", name: "Silent Singer" },
        { id: "bass-1", name: "Bass Player" },
        { id: "drums-1", name: "Drum Player" },
        { id: "keys-1", name: "Keys Player" },
        { id: "gtr-1", name: "Guitar Player" },
      ],
      presetCatalog: { vocal_no_mic: VOCAL_PRESET },
    });

    const suggestedForLead = candidates.filter(
      (candidate) => candidate.sectionByRole.lead === "suggested",
    );
    expect(suggestedForLead.length).toBeGreaterThan(0);
    expect(
      suggestedForLead.every((candidate) => candidate.primaryGroup === "vocs"),
    ).toBe(true);
  });
});
