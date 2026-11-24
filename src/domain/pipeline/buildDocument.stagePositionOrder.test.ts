import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  DocumentViewModel,
  Musician,
  NotesTemplate,
  PresetEntity,
  Project,
  StageplanLayout,
} from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

/**
 * Pořadí vokálních kanálů i monitorových řádků se řídí tím, kde vlastník na
 * pódiu **skutečně stojí** — hadem ze `resolveStagePositionOrder`. Pevné
 * tabulky rankou na skupinu, které tomu předcházely, byly jen zakódované
 * výchozí rozmístění: projekt na defaultu proto vychází stejně jako dřív, ale
 * jakmile uživatel bloky přetáhne, pořadí ho následuje. Přesně to tenhle
 * soubor drží — jinak by celá změna nebyla nikde na úrovni pipeline vidět.
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
  bandLeader: "voc-1",
  defaultLineup: {
    drums: ["drm-1"],
    bass: ["bass-1"],
    guitar: ["gtr-1"],
    keys: ["keys-1"],
    vocs: ["voc-1"],
  },
  defaultOverlays: {
    leadVocals: ["voc-1"],
    // Kytarista i basák zpívají back vokál. Vlastní blok na stage planu
    // nemají, takže jejich pozice = pozice jejich nástrojového bloku.
    backVocals: ["gtr-1", "bass-1"],
  },
};

function musician(
  id: string,
  group: Musician["group"],
  presetRef: string,
): Musician {
  return {
    id,
    firstName: id,
    lastName: "Player",
    gender: "m",
    group,
    presets: [
      { kind: "preset", ref: presetRef },
      { kind: "monitor", ref: "wedge_foh" },
    ],
  };
}

const musicians: Record<string, Musician> = {
  "drm-1": musician("drm-1", "drums", "drums_basic"),
  "bass-1": musician("bass-1", "bass", "el_bass_xlr_pedalboard"),
  "gtr-1": musician("gtr-1", "guitar", "el_guitar_mic"),
  "keys-1": musician("keys-1", "keys", "keys_mono"),
  "voc-1": musician("voc-1", "vocs", "vocal_lead_no_mic"),
};

function instrumentPreset(
  id: string,
  label: string,
  group: Musician["group"],
): PresetEntity {
  return {
    type: "preset",
    id,
    label,
    group,
    inputs: [{ key: id, label, group }],
  };
}

const presets: Record<string, PresetEntity> = {
  drums_basic: instrumentPreset("drums_basic", "Kick", "drums"),
  el_bass_xlr_pedalboard: instrumentPreset(
    "el_bass_xlr_pedalboard",
    "Electric bass guitar",
    "bass",
  ),
  el_guitar_mic: instrumentPreset("el_guitar_mic", "Electric guitar", "guitar"),
  keys_mono: instrumentPreset("keys_mono", "Keys", "keys"),
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
};

function createRepo(project: Project): DataRepository {
  return {
    getBand: () => band,
    getMusician: (id: string) => {
      const found = musicians[id];
      if (!found) throw new Error(`Unknown musician ${id}`);
      return found;
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

function buildVm(layout?: StageplanLayout): DocumentViewModel {
  const project: Project = {
    id: "project",
    bandRef: "band",
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: band.defaultLineup,
    overlays: band.defaultOverlays,
    ...(layout ? { stageplan: { layout } } : {}),
  };
  return buildDocument(project, createRepo(project));
}

function vocalOwners(vm: DocumentViewModel): string[] {
  return vm.inputs
    .filter((input) => input.group === "vocs")
    .map((input) => input.ownerMusicianId ?? "?");
}

function monitorOwners(vm: DocumentViewModel): string[] {
  return vm.monitorTableRows.map((row) => row.ownerMusicianId);
}

function block(
  slot: "drums" | "bass" | "guitar" | "keys" | "lead_voc_1",
  centerXM: number,
  centerYM: number,
) {
  return { slot, centerXM, centerYM, widthM: 2.7, depthM: 1.4, rotationDeg: 0 };
}

/** Uložené rozmístění KD Slavie — shodné s dopočítaným defaultem. */
const DEFAULT_LAYOUT: StageplanLayout = {
  stage: null,
  blocks: [
    block("drums", 6, 1.2),
    block("bass", 9.4, 1.2),
    block("guitar", 2.6, 5.5),
    block("keys", 9.4, 5.5),
    block("lead_voc_1", 6, 5.5),
  ],
};

/** Kytara a klávesy prohozené, basa a bicí zůstávají vzadu. */
const MIRRORED_LAYOUT: StageplanLayout = {
  stage: null,
  blocks: [
    block("drums", 6, 1.2),
    block("bass", 9.4, 1.2),
    block("keys", 2.6, 5.5),
    block("guitar", 9.4, 5.5),
    block("lead_voc_1", 6, 5.5),
  ],
};

describe("buildDocument — vocal and monitor order follows the stage layout", () => {
  it("reads the default layout as the snake guitar → lead → keys → bass → drums", () => {
    const vm = buildVm(DEFAULT_LAYOUT);
    // Kytarista je vepředu vlevo, takže jeho back vokál jde první — před lead
    // vokál uprostřed. Basák je v zadní, obrácené řadě, tedy poslední.
    expect(vocalOwners(vm)).toEqual(["gtr-1", "voc-1", "bass-1"]);
    expect(monitorOwners(vm)).toEqual([
      "gtr-1",
      "voc-1",
      "keys-1",
      "bass-1",
      "drm-1",
    ]);
  });

  it("gives a project with no saved layout the same order as the computed default", () => {
    // Jedna cesta řazení pro všechny projekty: chybějící layout se dopočítá,
    // ne obejde druhou fallback větví na pevnou tabulku.
    expect(vocalOwners(buildVm())).toEqual(
      vocalOwners(buildVm(DEFAULT_LAYOUT)),
    );
    expect(monitorOwners(buildVm())).toEqual(
      monitorOwners(buildVm(DEFAULT_LAYOUT)),
    );
  });

  it("follows the blocks after the user swaps guitar and keys", () => {
    const vm = buildVm(MIRRORED_LAYOUT);
    // Klávesy jsou teď vepředu vlevo a kytara vpravo, takže se kytarův back
    // vokál posune za lead vokál. Pevná tabulka skupin by tohle nezachytila.
    expect(vocalOwners(vm)).toEqual(["voc-1", "gtr-1", "bass-1"]);
    expect(monitorOwners(vm)).toEqual([
      "keys-1",
      "voc-1",
      "gtr-1",
      "bass-1",
      "drm-1",
    ]);
  });

  it("renumbers the printed back vocal labels along with the order", () => {
    // `slot` slouží zároveň jako číslo v labelu, takže přerovnání se vytiskne.
    // Overlay slot drží pořadí `backVocals`, pozice na pódiu řadí řádky.
    const labels = (vm: DocumentViewModel) =>
      vm.inputs
        .filter((input) => input.group === "vocs")
        .map((input) => input.label);
    expect(labels(buildVm(DEFAULT_LAYOUT))).toEqual([
      "Back vocal 1 (guitar)",
      "Lead vocal",
      "Back vocal 2 (bass)",
    ]);
    expect(labels(buildVm(MIRRORED_LAYOUT))).toEqual([
      "Lead vocal",
      "Back vocal 1 (guitar)",
      "Back vocal 2 (bass)",
    ]);
  });

  it("keeps every vocal label canonical so the rename lock in the UI still holds", () => {
    for (const layout of [DEFAULT_LAYOUT, MIRRORED_LAYOUT]) {
      const vocals = buildVm(layout).inputs.filter(
        (input) => input.group === "vocs",
      );
      expect(vocals).toHaveLength(3);
      expect(vocals.every((input) => input.labelIsCanonical)).toBe(true);
    }
  });
});
