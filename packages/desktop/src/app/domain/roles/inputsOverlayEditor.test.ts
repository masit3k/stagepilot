import { describe, expect, it } from "vitest";
import type { PresetEntity } from "../../../../../../src/domain/model/types";
import type { LineupMap } from "../../../projectRules";
import type { BandSetupData } from "../../shell/types";
import {
  applyTalkbackSelection,
  applyVocalOverlaySelection,
  resolveInputsOverlayEditorModel,
} from "./inputsOverlayEditor";

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

/**
 * `voc-1` a `voc-2` zpívají, `bass-1` je basák bez vokální schopnosti a
 * `voc-3` je v katalogu kapely, ale ne v sestavě projektu — právě ten případ,
 * kvůli kterému Task 15 pouští do kandidátů i katalog.
 */
const SETUP_DATA: BandSetupData = {
  id: "band",
  name: "Band",
  members: {
    vocs: [
      { id: "voc-1", name: "Vera Vocals" },
      { id: "voc-2", name: "Vince Vocals" },
      { id: "voc-3", name: "Vlasta Vocals" },
    ],
    bass: [{ id: "bass-1", name: "Bob Bass" }],
  },
  musicianPresetsById: {
    "voc-1": [{ kind: "preset", ref: "vocal_wireless" }],
    "voc-2": [{ kind: "preset", ref: "vocal_wireless" }],
    "voc-3": [{ kind: "preset", ref: "vocal_wireless" }],
    "bass-1": [{ kind: "preset", ref: "el_bass_xlr_amp" }],
  },
  defaultOverlays: { leadVocals: ["voc-1"], backVocals: ["voc-1", "voc-2"] },
  presetCatalog: PRESETS,
};

const LINEUP: LineupMap = {
  bass: [{ musicianId: "bass-1" }],
  vocs: [{ musicianId: "voc-1" }, { musicianId: "voc-2" }],
};

function resolve(
  overlays: Parameters<typeof resolveInputsOverlayEditorModel>[0]["overlays"],
) {
  return resolveInputsOverlayEditorModel({
    setupData: SETUP_DATA,
    presetCatalog: PRESETS,
    lineup: LINEUP,
    overlays,
  });
}

describe("resolveInputsOverlayEditorModel", () => {
  it("seeds the modals from the project's own overlays, never from the band defaults", () => {
    // `resolveCanonicalOverlayAssignments` čte jen `project.overlays` a
    // `normalizeCanonicalOverlays` z kapelních defaultů nic nedoplňuje —
    // změřeno: projekt bez `overlays` netiskne jediný vokální řádek.
    // Kdyby modál nabízel kapelní default, obrazovka `02` by ukazovala jiný
    // výběr, než jaký je v tabulce pod ním.
    const model = resolve({ leadVocals: ["voc-2"], backVocals: [] });

    expect(model.vocals.selectedLeadIds).toEqual(["voc-2"]);
    expect(model.vocals.selectedBackIds).toEqual([]);
    expect(model.defaultLeadIds).toEqual(["voc-1"]);
  });

  it("shows an empty selection for a project that carries no overlays at all", () => {
    const model = resolve(undefined);

    expect(model.vocals.selectedLeadIds).toEqual([]);
    expect(model.vocals.selectedBackIds).toEqual([]);
    expect(model.talkbackOwnerId).toBe("");
  });

  it("drops a musician from the band defaults who is both lead and back", () => {
    // `voc-1` je v obou kapelních seznamech; nabídnout ho modálu back vokálů
    // jako default by porušilo invariant, který se hned nato uplatní na výběru.
    expect(resolve(undefined).defaultBackIds).toEqual(["voc-2"]);
  });

  it("offers every lineup member as a talkback candidate and nobody else", () => {
    const model = resolve(undefined);

    expect(model.talkbackCandidates.map((member) => member.id)).toEqual([
      "bass-1",
      "voc-1",
      "voc-2",
    ]);
  });

  it("reads the talkback owner out of an assigned overlay", () => {
    const model = resolve({
      talkback: { mode: "assigned", ownerId: "bass-1" },
    });

    expect(model.talkbackOwnerId).toBe("bass-1");
  });

  it("reports nobody for an explicit talkback none", () => {
    const model = resolve({ talkback: { mode: "none", ownerId: null } });

    expect(model.talkbackOwnerId).toBe("");
  });

  it("lets a catalog musician outside the project lineup be a vocal candidate", () => {
    const model = resolve({ leadVocals: [], backVocals: [] });

    expect(model.vocals.candidateIds.has("voc-3")).toBe(true);
    // A talkback ho nenabídne — talkback musí být v sestavě, jinak ho
    // `resolveProjectTalkbackState` zahodí.
    expect(model.talkbackCandidates.some((m) => m.id === "voc-3")).toBe(false);
  });

  it("returns an empty model when the band setup has not loaded yet", () => {
    const model = resolveInputsOverlayEditorModel({
      setupData: null,
      presetCatalog: {},
      lineup: LINEUP,
      overlays: { leadVocals: ["voc-1"], backVocals: [] },
    });

    expect(model.vocals.hasCandidates).toBe(false);
    expect(model.talkbackCandidates).toEqual([]);
  });
});

describe("applyVocalOverlaySelection", () => {
  const musiciansById = new Map([
    ["voc-1", { group: "vocs" as const }],
    ["voc-2", { group: "vocs" as const }],
    ["voc-3", { group: "vocs" as const }],
    ["bass-1", { group: "bass" as const }],
  ]);

  it("writes the selection into overlays and never touches presetOverride", () => {
    // Jádro R7: přidání i odebrání vokalisty je změna overlays a sestavy.
    // `inputs.add` na vokálním slotu NENÍ no-op (`buildDocument.ts` vylučuje
    // z `eventOverride` jen `bass` a `drums`) — vytiskl by trvalý osiřelý
    // řádek s `ownerMusicianId: undefined`. Doména tuhle bránu neduplikuje,
    // takže jediná ochrana je tady.
    const next = applyVocalOverlaySelection({
      lineup: LINEUP,
      overlays: { leadVocals: ["voc-1"], backVocals: [] },
      musiciansById,
      candidateIds: new Set(["voc-1", "voc-2", "voc-3"]),
      leadIds: ["voc-1", "voc-2"],
      backIds: [],
    });

    expect(next.overlays).toEqual({
      leadVocals: ["voc-1", "voc-2"],
      backVocals: [],
    });
    expect(JSON.stringify(next.lineup)).not.toContain("presetOverride");
    expect(JSON.stringify(next.lineup)).not.toContain("inputs");
  });

  it("pulls a selected musician who is outside the lineup into it", () => {
    // Bez toho by overlay ukazoval na někoho, koho
    // `resolveCanonicalOverlayAssignments` odfiltruje, a řádek by se nevytiskl.
    const next = applyVocalOverlaySelection({
      lineup: LINEUP,
      overlays: { leadVocals: [], backVocals: [] },
      musiciansById,
      candidateIds: new Set(["voc-1", "voc-2", "voc-3"]),
      leadIds: ["voc-3"],
      backIds: [],
    });

    expect(next.lineup.vocs).toEqual([
      { musicianId: "voc-1" },
      { musicianId: "voc-2" },
      { musicianId: "voc-3" },
    ]);
    expect(next.overlays.leadVocals).toEqual(["voc-3"]);
  });

  it("leaves the lineup slot in place when a vocalist is removed from the overlay", () => {
    // Řádek zmizí přes overlays, ne přes patch — `buildPdfMonitorRows` po
    // Tasku 14 uklidí i monitor mix, protože slot má lineup roli `vocs`.
    const next = applyVocalOverlaySelection({
      lineup: LINEUP,
      overlays: { leadVocals: ["voc-1", "voc-2"], backVocals: [] },
      musiciansById,
      candidateIds: new Set(["voc-1", "voc-2"]),
      leadIds: ["voc-1"],
      backIds: [],
    });

    expect(next.lineup.vocs).toEqual([
      { musicianId: "voc-1" },
      { musicianId: "voc-2" },
    ]);
    expect(next.overlays.leadVocals).toEqual(["voc-1"]);
  });

  it("applies the lead/back invariant and drops ids that are not candidates", () => {
    const next = applyVocalOverlaySelection({
      lineup: LINEUP,
      overlays: undefined,
      musiciansById,
      candidateIds: new Set(["voc-1", "voc-2"]),
      leadIds: ["voc-1"],
      backIds: ["voc-1", "voc-2", "ghost"],
    });

    expect(next.overlays).toEqual({
      leadVocals: ["voc-1"],
      backVocals: ["voc-2"],
    });
  });

  it("keeps an existing talkback overlay untouched", () => {
    const next = applyVocalOverlaySelection({
      lineup: LINEUP,
      overlays: {
        leadVocals: [],
        backVocals: [],
        talkback: { mode: "assigned", ownerId: "bass-1" },
      },
      musiciansById,
      candidateIds: new Set(["voc-1"]),
      leadIds: ["voc-1"],
      backIds: [],
    });

    expect(next.overlays.talkback).toEqual({
      mode: "assigned",
      ownerId: "bass-1",
    });
  });
});

describe("applyTalkbackSelection", () => {
  it("writes an assigned owner without disturbing the vocal overlays", () => {
    expect(
      applyTalkbackSelection(
        { leadVocals: ["voc-1"], backVocals: [] },
        "bass-1",
      ),
    ).toEqual({
      leadVocals: ["voc-1"],
      backVocals: [],
      talkback: { mode: "assigned", ownerId: "bass-1" },
    });
  });

  it("writes an explicit none for nobody assigned", () => {
    expect(applyTalkbackSelection(undefined, null)).toEqual({
      talkback: { mode: "none", ownerId: null },
    });
  });

  it("treats an empty id as nobody assigned", () => {
    expect(applyTalkbackSelection(undefined, "")).toEqual({
      talkback: { mode: "none", ownerId: null },
    });
  });
});
