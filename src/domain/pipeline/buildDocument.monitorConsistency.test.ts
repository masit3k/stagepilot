import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  DocumentViewModel,
  Musician,
  NotesTemplate,
  PresetEntity,
  Project,
  ProjectOverlays,
} from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

/**
 * `vm.monitors` a `vm.monitorTableRows` jsou dvě poloviny téhož švu: seznam
 * monitorů slibuje zařízení, tabulka ho tiskne. Vlastníky řádků vybírá
 * `resolvePdfMonitorOwners` (F5d Nález 1) — slot s lineup rolí `vocs`, který
 * není v žádném vokálním overlay slotu, netiskne jediný kanál, takže řádek
 * nedostane. Entity se stavěly nezávisle na řádcích, takže dokument mohl nést
 * monitor, který tabulka nikde nezmiňuje; `vm.monitors` navíc řídí podmínky
 * poznámek (`deriveMonitorNoteContext`), takže osiřelý monitor uměl zapnout
 * poznámku o zařízení, které se netiskne.
 */

const notesTemplate: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

const band: Band = {
  id: "band",
  name: "Band",
  bandLeader: "bass-1",
  defaultLineup: { bass: ["bass-1"], vocs: ["voc-1"] },
  defaultOverlays: { leadVocals: [], backVocals: [] },
};

const musicians: Record<string, Musician> = {
  "bass-1": {
    id: "bass-1",
    firstName: "Bass",
    lastName: "Player",
    gender: "m",
    group: "bass",
    presets: [
      { kind: "preset", ref: "el_bass_xlr_pedalboard" },
      { kind: "monitor", ref: "iem_stereo_wireless_foh" },
    ],
  },
  "voc-1": {
    id: "voc-1",
    firstName: "Vocal",
    lastName: "Player",
    gender: "f",
    group: "vocs",
    presets: [
      { kind: "preset", ref: "vocal_lead_no_mic" },
      { kind: "monitor", ref: "wedge_foh" },
    ],
  },
};

const presets: Record<string, PresetEntity> = {
  el_bass_xlr_pedalboard: {
    type: "preset",
    id: "el_bass_xlr_pedalboard",
    label: "Electric bass guitar",
    group: "bass",
    inputs: [
      {
        key: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
      },
    ],
  },
  vocal_lead_no_mic: {
    type: "preset",
    id: "vocal_lead_no_mic",
    label: "Lead vocal no mic",
    group: "vocs",
    inputs: [
      { key: "voc_cap_no_mic", label: "Lead vocal capability", group: "vocs" },
    ],
  },
  wedge_foh: {
    type: "monitor",
    id: "wedge_foh",
    label: "Wedge monitor (provided by FOH)",
    kind: "wedge",
    supplier: "foh",
  },
  iem_stereo_wireless_foh: {
    type: "monitor",
    id: "iem_stereo_wireless_foh",
    label: "IEM STEREO wireless (provided by FOH)",
    kind: "iem",
    supplier: "foh",
    mode: "stereo",
    wireless: true,
  },
};

function createRepo(project: Project): DataRepository {
  return {
    getBand: () => band,
    getMusician: (id: string) => {
      const musician = musicians[id];
      if (!musician) throw new Error(`Unknown musician ${id}`);
      return musician;
    },
    getProject: () => project,
    getPreset: (id: string) => {
      const preset = presets[id];
      if (!preset) throw new Error(`Unknown preset ${id}`);
      return preset;
    },
    getNotesTemplate: () => notesTemplate,
  };
}

function buildVm(overlays: ProjectOverlays): DocumentViewModel {
  const project: Project = {
    id: "project",
    bandRef: "band",
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: band.defaultLineup,
    overlays,
  };
  return buildDocument(project, createRepo(project));
}

/** Vlastník entity je prefix jejího id — `${musicianId}:${monitorPresetId}`. */
function monitorOwnerIds(vm: DocumentViewModel): string[] {
  return vm.monitors.map((monitor) =>
    monitor.id.slice(0, monitor.id.lastIndexOf(":")),
  );
}

/**
 * Vazba, kterou testy drží do budoucna: každá entita v `vm.monitors` má řádek
 * v `vm.monitorTableRows` a naopak. Pořadí se porovnává setříděné schválně —
 * entity jdou v pořadí lineupu, řádky v business pořadí skupin.
 */
function expectMonitorsMatchRows(vm: DocumentViewModel): void {
  expect(monitorOwnerIds(vm).sort()).toEqual(
    [...new Set(vm.monitorTableRows.map((row) => row.ownerMusicianId))].sort(),
  );
}

describe("buildDocument monitor entity/row consistency", () => {
  it("drops the monitor entity of a vocs slot that is in no vocal overlay", () => {
    const vm = buildVm({
      leadVocals: [],
      backVocals: [],
      talkback: { mode: "none", ownerId: null },
    });

    expect(vm.monitorTableRows.map((row) => row.ownerMusicianId)).toEqual([
      "bass-1",
    ]);
    expect(vm.monitors.map((monitor) => monitor.id)).toEqual([
      "bass-1:iem_stereo_wireless_foh",
    ]);
    expectMonitorsMatchRows(vm);
  });

  it("keeps both halves for a vocs slot that is in the lead overlay", () => {
    const vm = buildVm({
      leadVocals: ["voc-1"],
      backVocals: [],
      talkback: { mode: "none", ownerId: null },
    });

    expect(vm.monitorTableRows.map((row) => row.ownerMusicianId)).toEqual([
      "voc-1",
      "bass-1",
    ]);
    expect(vm.monitors.map((monitor) => monitor.id)).toEqual([
      "bass-1:iem_stereo_wireless_foh",
      "voc-1:wedge_foh",
    ]);
    expectMonitorsMatchRows(vm);
  });
});
