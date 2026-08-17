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
      if (
        !setupData.notesTemplateRef ||
        id !== setupData.notesTemplateRef ||
        !setupData.notesTemplate
      ) {
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
 * s projektovým lineupem, kde slot je `string | { musicianId, ... }`, případně
 * pole takových položek). Kapelní storage je uživatelsky editovaný JSON, takže
 * i objektový tvar (`{ "bass": [{ "musicianId": "bass-1" }] }`) je reálně
 * dosažitelný — Rust strana příkazu ověří jen že hodnota role je array
 * (`lib.rs:153-171`), obsah prvků nekontroluje. `toDefaultLineup` proto čte
 * `musicianId` z objektové podoby stejně jako `normalizeLineupValue`
 * (`projectRules.ts:281-292`) a položku, ze které nevzejde žádné id,
 * zahodí — nevyhazuje. Obrazovka `02` se musí vykreslit i s neúplnými daty;
 * na to slouží `load_warnings`, ne shozený render. Nejde o normalizaci
 * projektového lineupu (ta zůstává na `normalizeProject`, který používá
 * volající) — jen o čtení téhož tvaru, jaký zná zbytek aplikace.
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
    defaultLineup: toDefaultLineup(setupData.defaultLineup),
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

function toDefaultLineup(raw: BandSetupData["defaultLineup"]): DefaultLineup {
  const lineup: DefaultLineup = {};
  if (!raw) return lineup;

  for (const group of BAND_LINEUP_GROUPS) {
    const value = raw[group];
    if (value === undefined) continue;

    const entries = Array.isArray(value) ? value : [value];
    const ids = entries
      .map((entry) =>
        typeof entry === "string" ? entry : (entry?.musicianId ?? ""),
      )
      .filter((id): id is string => id.length > 0);
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
