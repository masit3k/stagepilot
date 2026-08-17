import type {
  Band,
  DefaultLineup,
  DefaultOverlays,
  Group,
  Musician,
  NotesTemplate,
  PresetEntity,
  Project,
} from "../../../../../../src/domain/model/types";
import type { DataRepository } from "../../../../../../src/infra/fs/repo";
import type { BandSetupData } from "../../shell/types";

/**
 * Co? Adaptér, který sloučí `BandSetupData` (payload z Tauri příkazu
 * `get_band_setup_data`) do `DataRepository`, kterému rozumí `buildDocument`.
 *
 * Proč existuje? Obrazovka `02 INPUTS` má být zrcadlem strany 1 dokumentu
 * (R1) — stejné pořadí, stejná čísla kanálů, stejně slité stereo páry. Jediný
 * způsob, jak to zaručit, je nechat čísla počítat samotný `buildDocument` a
 * nepočítat je znovu v UI. Bez tohohle adaptéru by editor musel čísla
 * odhadovat sám — a přesně to bylo review Tasku 11 odhalilo jako rozešlé se
 * čtyřmi příčinami. Tenhle modul je jediné místo, kde se tvar obrazovky
 * (`BandSetupData`) překlápí na tvar pipeline (`DataRepository`); nic víc,
 * nic chytřejšího — join řádků staví až Task 11c nad výstupem `buildDocument`.
 */
export function createDocumentRepository(args: {
  project: Project;
  setupData: BandSetupData;
}): DataRepository {
  const { project, setupData } = args;

  return {
    getProject: () => project,

    getMusician: (id: string): Musician => {
      const musician = setupData.musicians?.[id];
      if (!musician)
        throw new Error(`Musician not found in band setup data: ${id}`);
      return musician;
    },

    getPreset: (id: string): PresetEntity => {
      const preset = setupData.presetCatalog?.[id];
      if (!preset)
        throw new Error(`Preset not found in band setup data: ${id}`);
      return preset;
    },

    getNotesTemplate: (id: string): NotesTemplate => {
      if (!setupData.notesTemplateRef || id !== setupData.notesTemplateRef) {
        throw new Error(`Notes template not found in band setup data: ${id}`);
      }
      if (!setupData.notesTemplate) {
        throw new Error(`Notes template not found in band setup data: ${id}`);
      }
      return setupData.notesTemplate;
    },

    getBand: (): Band => buildBand(setupData),
  };
}

/**
 * Skládá `Band` ze `setupData`. Jediné pole, které vyžaduje práci, je
 * `defaultLineup` — `BandSetupData` ho typuje jako `LineupMap` (sdílený tvar
 * s projektovým lineupem, kde slot může nést i `presetOverride`/`drumDefinition`),
 * ale kapelní default lineup nikdy takhle bohatý není: reálná data z disku
 * (viz `catalog/bands/*.json`) i Rust strana příkazu ho drží jako
 * `Record<Group, string[]>`. Převod tedy jen ověří tenhle předpoklad a
 * vyhodí čitelnou chybu, pokud by ho jednou porušil — nejde o normalizaci
 * projektového lineupu (ta zůstává na `normalizeProject`, který používá
 * volající), jen o úzké přetypování jednoho pole kapely.
 */
function buildBand(setupData: BandSetupData): Band {
  const bandLeader =
    setupData.bandLeader ?? setupData.bandLeaderId ?? undefined;

  return {
    id: setupData.id,
    name: setupData.name,
    bandLeader: bandLeader ?? "",
    bandLeaderId: setupData.bandLeaderId ?? bandLeader,
    defaultTalkbackOwnerId: setupData.defaultTalkbackOwnerId ?? undefined,
    defaultContactId: setupData.defaultContactId ?? undefined,
    defaultLineup: toDefaultLineup(setupData.defaultLineup, setupData.id),
    defaultOverlays: toDefaultOverlays(setupData.defaultOverlays),
    notesTemplateRef: setupData.notesTemplateRef ?? undefined,
  };
}

const BAND_LINEUP_GROUPS: readonly Group[] = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "vocs",
  "talkback",
];

function toDefaultLineup(
  raw: BandSetupData["defaultLineup"],
  bandId: string,
): DefaultLineup {
  const lineup: DefaultLineup = {};
  if (!raw) return lineup;

  for (const group of BAND_LINEUP_GROUPS) {
    const value = raw[group];
    if (value === undefined) continue;

    const entries = Array.isArray(value) ? value : [value];
    const ids: string[] = [];
    for (const entry of entries) {
      if (typeof entry !== "string") {
        throw new Error(
          `Band ${bandId} defaultLineup.${group} must list musician ids, found: ${JSON.stringify(entry)}`,
        );
      }
      ids.push(entry);
    }
    lineup[group] = ids;
  }

  return lineup;
}

function toDefaultOverlays(
  raw: BandSetupData["defaultOverlays"],
): DefaultOverlays | undefined {
  if (!raw) return undefined;
  return {
    leadVocals: raw.leadVocals ?? undefined,
    backVocals: raw.backVocals ?? undefined,
  };
}
