import { describe, expect, it } from "vitest";
import type {
  Musician,
  PresetEntity,
} from "../../../../../../src/domain/model/types";
import { resolveVocalOverlayEditorModel } from "./resolveVocalOverlayEditorModel";

const PRESETS: Record<string, PresetEntity> = {
  vocal_wireless: {
    type: "preset",
    id: "vocal_wireless",
    label: "Vocal (wireless)",
    group: "vocs",
    capabilities: ["vocal"],
    inputs: [{ key: "voc_input", label: "Vocal" }],
  },
  el_bass_xlr_amp: {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Electric bass guitar",
    group: "bass",
    inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar" }],
  },
};

/** A pure vocalist, a bass player who also sings, and a drummer who does not. */
const SINGER: Musician = {
  id: "voc-1",
  firstName: "Vera",
  lastName: "Vocals",
  group: "vocs",
  presets: [{ kind: "preset", ref: "vocal_wireless" }],
};
const SINGING_BASSIST: Musician = {
  id: "bass-1",
  firstName: "Bob",
  lastName: "Bass",
  group: "bass",
  presets: [
    { kind: "preset", ref: "el_bass_xlr_amp" },
    { kind: "preset", ref: "vocal_wireless" },
  ],
};
/** A vocalist whose presets carry no vocal capability at all. */
const MUTE_SINGER: Musician = {
  id: "voc-2",
  firstName: "Mia",
  lastName: "Mute",
  group: "vocs",
  presets: [],
};
const SILENT_DRUMMER: Musician = {
  id: "drums-1",
  firstName: "Dana",
  lastName: "Drums",
  group: "drums",
  presets: [],
};
const MEMBERS = [
  { id: "voc-1", name: "Vera Vocals" },
  { id: "bass-1", name: "Bob Bass" },
  { id: "drums-1", name: "Dana Drums" },
  { id: "voc-2", name: "Mia Mute" },
];

function model(overrides: {
  lineup?: Musician[];
  catalog?: Musician[];
  rawLeadIds?: string[];
  rawBackIds?: string[];
}) {
  const lineup = overrides.lineup ?? [SINGER, SINGING_BASSIST];
  const catalog = overrides.catalog ?? [
    SINGER,
    SINGING_BASSIST,
    SILENT_DRUMMER,
  ];
  return resolveVocalOverlayEditorModel({
    lineupMusicians: lineup,
    lineupMembers: MEMBERS.filter((m) => lineup.some((l) => l.id === m.id)),
    catalogMusicians: catalog,
    catalogMembers: MEMBERS.filter((m) => catalog.some((c) => c.id === m.id)),
    presetCatalog: PRESETS,
    rawLeadIds: overrides.rawLeadIds ?? [],
    rawBackIds: overrides.rawBackIds ?? [],
  });
}

describe("resolveVocalOverlayEditorModel", () => {
  it("reports no candidates when neither the lineup nor the catalog holds one", () => {
    const result = model({ lineup: [], catalog: [] });

    expect(result.hasCandidates).toBe(false);
    expect(result.candidateIds.size).toBe(0);
    expect(result.selectedLeadIds).toEqual([]);
    expect(result.selectedBackIds).toEqual([]);
    expect(result.leadMembers).toEqual([]);
    expect(result.leadSections.suggestedLeadVocalCandidates).toEqual([]);
    expect(result.leadSections.otherLeadVocalCandidates).toEqual([]);
    expect(result.backSections.suggested).toEqual([]);
    expect(result.backSections.additional).toEqual([]);
  });

  it("reports both a vocalist and a singing instrumentalist as candidates", () => {
    const result = model({});

    expect(result.hasCandidates).toBe(true);
    expect([...result.candidateIds].sort()).toEqual(["bass-1", "voc-1"]);
  });

  it("keeps catalog singers as candidates even when the lineup is empty", () => {
    const result = model({ lineup: [] });

    expect(result.hasCandidates).toBe(true);
    expect([...result.candidateIds].sort()).toEqual(["bass-1", "voc-1"]);
  });

  it("keeps a musician selected as lead out of the back selection", () => {
    // `enforceVocalSelectionInvariant` — a musician cannot be both.
    const result = model({ rawLeadIds: ["voc-1"], rawBackIds: ["voc-1"] });

    expect(result.selectedLeadIds).toEqual(["voc-1"]);
    expect(result.selectedBackIds).toEqual([]);
  });

  it("marks an already-selected lead vocalist as disabled among back candidates", () => {
    const result = model({ rawLeadIds: ["voc-1"] });
    const entry = [
      ...result.backSections.suggested,
      ...result.backSections.additional,
    ].find((candidate) => candidate.id === "voc-1");

    expect(entry?.isDisabled).toBe(true);
    expect(entry?.disabledReason).toBe("Already selected as Lead Vocal");
  });

  it("does not disable a back candidate who is not selected as lead", () => {
    const result = model({ rawLeadIds: ["voc-1"] });
    const entry = [
      ...result.backSections.suggested,
      ...result.backSections.additional,
    ].find((candidate) => candidate.id === "bass-1");

    expect(entry?.isDisabled).toBe(false);
    expect(entry?.disabledReason).toBeUndefined();
  });

  it("drops a selected id that is not a vocal candidate at all", () => {
    const result = model({
      lineup: [SINGER],
      rawLeadIds: ["voc-1"],
      rawBackIds: ["drums-1"],
    });

    expect(result.candidateIds.has("drums-1")).toBe(false);
    expect(result.selectedLeadIds).toEqual(["voc-1"]);
    expect(result.selectedBackIds).toEqual([]);
  });

  it("resolves member display names from the catalog, in selection order", () => {
    // `bass-1` sits in the catalog only, so lineup members alone cannot name him.
    const result = model({
      lineup: [SINGER],
      rawLeadIds: ["voc-1"],
      rawBackIds: ["bass-1"],
    });

    expect(result.leadMembers.map((member) => member.name)).toEqual([
      "Vera Vocals",
    ]);
    expect(result.backMembers.map((member) => member.name)).toEqual([
      "Bob Bass",
    ]);
  });

  it("offers a catalog vocalist without a vocal preset for lead but not for back", () => {
    const result = model({
      catalog: [SINGER, SINGING_BASSIST, SILENT_DRUMMER, MUTE_SINGER],
    });

    expect(result.candidateIds.has("voc-2")).toBe(true);
    expect(
      result.leadSections.otherLeadVocalCandidates.map(
        (candidate) => candidate.musicianId,
      ),
    ).toContain("voc-2");
    expect(
      [...result.backSections.suggested, ...result.backSections.additional].map(
        (candidate) => candidate.id,
      ),
    ).not.toContain("voc-2");
  });

  it("splits back candidates into suggested singers and other lineup members", () => {
    const result = model({ lineup: [SINGER, SINGING_BASSIST, SILENT_DRUMMER] });

    expect(result.backSections.suggested.map((c) => c.id)).toEqual([
      "bass-1",
      "voc-1",
    ]);
    expect(result.backSections.additional.map((c) => c.id)).toEqual([
      "drums-1",
    ]);
  });

  it("splits lead candidates into suggested vocalists and other lineup members", () => {
    const result = model({});

    expect(
      result.leadSections.suggestedLeadVocalCandidates.map(
        (candidate) => candidate.musicianId,
      ),
    ).toEqual(["voc-1"]);
    expect(
      result.leadSections.otherLeadVocalCandidates.map(
        (candidate) => candidate.musicianId,
      ),
    ).toEqual(["bass-1"]);
  });
});
