// src/domain/model/types.ts
// Co? Typové definice doménových entit a výstupního view modelu.
// Proč? Musí odpovídat reálným JSONům, jinak se rozbije pipeline i TS kontrola.

import type { DrumDefinition } from "../drums/drumDefinition.js";
import type { Group } from "./groups.js";
export type { Group } from "./groups.js";

/* ============================================================
 * Project (domain) + ProjectJson (input)
 * ============================================================ */

/**
 * Účel stageplanu.
 * - event: jednorázová akce (vyžaduje datum + místo konání)
 * - generic: univerzální/sezónní dokument (datum = aktualizace/vytvoření, místo není vyžadováno)
 */
export type StagePlanPurpose = "event" | "generic";

export type StageplanInstrument = "Drums" | "Bass" | "Guitar" | "Keys" | "Lead vocal";
export type StageplanInstrumentKey = "drums" | "bass" | "guitar" | "vocs" | "keys";

export type StageplanPerson = {
  musicianId?: string;
  firstName: string | null;
  isBandLeader: boolean;
};

export type LineupSlot = {
  slot: number;
  musicianId: string;
  presetOverride?: PresetOverridePatch;
  drumDefinition?: DrumDefinition;
};

export type ProjectLineup = Partial<Record<Group, LineupSlot[]>> & Record<string, unknown>;

export type ProjectOverlays = {
  leadVocals?: string[];
  backVocals?: string[];
  talkback?: { mode: "none"; ownerId: null } | { mode: "assigned"; ownerId: string };
};

/**
 * Normalizovaný doménový projekt (po načtení a normalizaci z JSONu).
 * Tohle má používat pipeline.
 */
export interface Project {
  id: string;
  slug?: string;
  displayName?: string;
  bandRef: string; // band.id

  purpose: StagePlanPurpose;

  /** Datum konání akce (jen pro purpose="event") */
  eventDate?: string; // ISO "YYYY-MM-DD"

  /** Místo konání akce (jen pro purpose="event") */
  eventVenue?: string;

  /** Datum vytvoření/aktualizace dokumentu (vždy) */
  documentDate: string; // ISO "YYYY-MM-DD"

  /** Poznámka k projektu (tour/sezóna/poznámka), typicky pro purpose="generic" */
  note?: string;
  createdAt?: string;
  updatedAt?: string;

  /** Poslední změna obsahu rideru. Čte ji hlavička PDF. */
  contentUpdatedAt?: string;

  /** Volitelně: volba template/layoutu */
  template?: string;
  lineup?: ProjectLineup | Record<string, unknown>;
  overlays?: ProjectOverlays;
  bandLeaderId?: string;
  talkbackOverride?:
    | { mode: "none" }
    | { mode: "assigned"; musicianId: string };

  stageplan?: {
    powerOverridesByMusician?: Record<string, PowerRequirement>;
  };
}

/**
 * Legacy podoba project.json (současný stav v repu).
 * Loader může tenhle tvar přijmout a převést na Project (normalize).
 */
export interface LegacyProjectJson {
  id: string;
  bandRef: string;
  date: string; // ISO "YYYY-MM-DD"
  venue?: string;
  stageplan?: {
    powerOverridesByMusician?: Record<string, PowerRequirement>;
  };
}

/**
 * Nová podoba project.json (doporučený vstup do budoucna).
 * Pokud ji použiješ hned v datech, loader může být jednodušší.
 */
export interface ProjectJsonV2 {
  id: string;
  slug?: string;
  displayName?: string;
  bandRef: string;

  purpose: StagePlanPurpose;

  eventDate?: string;
  eventVenue?: string;

  documentDate: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;

  /** Poslední změna obsahu rideru. Čte ji hlavička PDF. */
  contentUpdatedAt?: string;
  /** Legacy read-compat only. */
  title?: string;
  template?: string;
  lineup?: ProjectLineup | Record<string, unknown>;
  overlays?: ProjectOverlays;
  bandLeaderId?: string;
  talkbackOverride?:
    | { mode: "none" }
    | { mode: "assigned"; musicianId: string };
  stageplan?: {
    powerOverridesByMusician?: Record<string, PowerRequirement>;
  };
}

/**
 * Projekt v JSONu může být dočasně legacy nebo V2.
 * Loader má zodpovědnost sjednotit na `Project`.
 */
export type ProjectJson = LegacyProjectJson | ProjectJsonV2;

/** Canonical default lineup kapely: group -> ordered musicianId[] */
export type DefaultLineup = Partial<Record<Group, string[]>>;

/** Canonical explicit vocal assignments overlaying default lineup membership. */
export type DefaultOverlays = {
  leadVocals?: string[];
  backVocals?: string[];
};

/** Kapela: statická definice (knihovna). */
export interface Band {
  type?: "band";
  id: string;
  code?: string;
  name: string;

  bandLeader: string;

  /** Výchozí obsazení kapely pro generování (group -> musicianId(s)). */
  defaultLineup: DefaultLineup;

  /** Výchozí overlay role nad default lineup membership. */
  defaultOverlays?: DefaultOverlays;
  /** @deprecated canonical alias */
  bandLeaderId?: string;
  defaultTalkbackOwnerId?: string;

  defaultContactId?: string;

  /** Volitelné: reference na notes template */
  notesTemplateRef?: string;

  /** Volitelné: relativní cesta k logu (od root projektu) */
  logoFile?: string;
}

/** Muzikant: profil osoby a reference na presety, které používá. */
export interface Musician {
  id: string;
  firstName: string;
  lastName: string;
  gender?: "m" | "f" | "x";
  group: Group;
  contactRef?: string;

  /** V2: explicitní položky s discriminator `kind` */
  presets: PresetItem[];
  requirements?: {
    power?: PowerRequirement;
  };
}

/** Jedna položka presetů na muzikantovi (V2). */
export type PresetItem =
  | {
      kind: "preset";
      ref: string;
    }
  | {
      kind: "drum_setup";
      setup: DrumDefinition;
    }
  | {
      kind: "talkback";
      ref: string;
      ownerKey: string;
      ownerLabel?: string;
    }
  | {
      kind: "monitor";
      ref: string;
    };

/** Jeden vstupní kanál (z presetů). */
export interface InputChannel {
  id?: string;
  key: string;
  label: string;
  baseLabel?: string;
  compactGroupKey?: string;
  channel?: "L" | "R";
  group?: Group; // když chybí, doplní se podle lineup group
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** FOH preset: sada inputů pro jednu část setupu (např. drums standard 9). */
export interface Preset {
  type: "preset";
  id: string;
  label: string;
  group: Group;
  capabilities?: PresetCapability[];
  /** Optional subgroup used by setup editors (e.g. bass connection variants). */
  setupGroup?: string;
  presetRole?: "primary" | "addition";
  inputs: InputChannel[];
}

export type PresetCapability = "vocal";

export type MonitoringPreset = {
  monitorRef: string;
  additionalWedgeCount?: number;
};

export type PartialInputUpdate = {
  key: string;
  label?: string;
  baseLabel?: string;
  compactGroupKey?: string;
  channel?: "L" | "R";
  note?: string;
  group?: Group;
};

export type InputReplacePatch = {
  targetKey: string;
  with: InputChannel;
};

export type PresetOverridePatch = {
  monitoring?: Partial<MonitoringPreset>;
  inputs?: {
    add?: InputChannel[];
    remove?: string[];
    replace?: InputReplacePatch[];
    /** Legacy alias kept for read compatibility. */
    removeKeys?: string[];
    update?: PartialInputUpdate[];
  };
};

export type MusicianSetupPreset = {
  inputs: InputChannel[];
  monitoring: MonitoringPreset;
};

export type PowerRequirement = {
  voltage: number;
  sockets: number;
};

/** Talkback "typ" – šablona pro talkback input. */
export interface TalkbackType {
  type: "talkback_type";
  id: string;
  label: string;
  group: Group; // "talkback"
  input: {
    key: string; // např. "tb_{ownerKey}"
    label: string; // např. "Talkback ({ownerLabel})"
    note?: string;
  createdAt?: string;
  updatedAt?: string;
  };
}

/** Monitor mix typ (zatím se nepromítá do FOH input listu). */
export interface Monitor {
  type: "monitor";
  id: string;
  label: string;
}

/** Union všech entit v data/assets/presets */
export type PresetEntity = Preset | TalkbackType | Monitor;

/* ============================================================
 * Notes (pod tabulkami)
 * ============================================================ */

export type NoteSeverity = "info" | "warning";

export type NoteCondition = { monitors: { hasWedge: true } };

export interface NoteLine {
  id: string;
  text: string;
  severity?: NoteSeverity;
  when?: NoteCondition;
}

/** Notes template držíme jako data (JSON), ne hardcode v šabloně. */
export interface NotesTemplate {
  id: string;
  lang: "cs";
  inputs: NoteLine[];
  monitors: NoteLine[];
}

/* ============================================================
 * Output view model (pipeline -> template)
 * ============================================================ */

/**
 * Meta řádek je buď:
 * - labeled: "Label: value"
 * - plain: jeden textový řádek (např. "Tour 35 let – datum aktualizace: ...")
 *
 * Tohle je přenosný formát mezi pipeline a template,
 * aby template nemusel hádat sémantiku projektu.
 */
export type MetaLineModel =
  | {
      kind: "labeled";
      label: string;
      value: string;
    }
  | {
      kind: "plain";
      value: string;
    }
  | {
      kind: "split";
      subtitle: string;
      updateDateLabel: string;
      updateDateValue: string;
    };

/** Výstup pipeline – připraveno pro render (PDF) nebo export. */
export interface DocumentViewModel {
  meta: {
    projectId: string;
    bandName: string;

    purpose: StagePlanPurpose;

    /** Normalizovaná projektová data (pro debug/export i template) */
    eventDate?: string;
    eventVenue?: string;
    documentDate: string;
    note?: string;
  createdAt?: string;
  updatedAt?: string;

    /** Už připravený meta řádek k vytištění */
    metaLine: MetaLineModel;

    /** Volitelné: relativní cesta k logu (od root projektu) */
    logoFile?: string;
  };

  /**
   * Canonical FOH inputs (1 řádek = 1 fyzický input kanál).
   * Používá se pro validaci (limity, unikátní klíče) a pro deterministické číslování.
   */
  inputs: Array<{
    ch: number;
    key: string;
    label: string;
    baseLabel?: string;
    compactGroupKey?: string;
    channel?: "L" | "R";
    group: Group;
    note?: string;
    ownerRole?: Group;
    ownerMusicianId?: string;
  createdAt?: string;
  updatedAt?: string;
  }>;

  /**
   * View-only řádky pro Input list (to, co se tiskne do tabulky).
   * Umožňuje sloučení stereo párů do formátu "13+14" bez toho, aby se měnila kanonická data.
   */
  inputRows: Array<{
    no: string;
    label: string;
    note?: string;
  createdAt?: string;
  updatedAt?: string;
  }>;

  /**
   * Monitory (pro podmínky poznámek).
   * kind = "wedge" znamená klasický pódiový odposlech.
   */
  monitors: Array<{
    id: string;
    label: string;
    kind: "iem" | "wedge";
  }>;

  /** Poznámky pod tabulkami (už vyfiltrované podle podmínek). */
  notes: {
    inputs: NoteLine[];
    monitors: NoteLine[];
  };

  monitorTableRows: Array<{
    no: string;
    output: string;
    note: string;
    ownerRole: Group;
    ownerMusicianId: string;
  }>;

  stageplan: {
    lineupByRole: Partial<Record<StageplanInstrumentKey, StageplanPerson>>;
    leadVocals?: StageplanPerson[];
    inputs: Array<{
      channelNo: number;
      label: string;
      group: Group;
      ownerRole?: Group;
      ownerMusicianId?: string;
    }>;
    monitorOutputs: Array<{
      no: number;
      output: string;
      note: string;
      ownerRole?: Group;
      ownerMusicianId?: string;
    }>;
    powerByRole: Partial<
      Record<
        StageplanInstrumentKey,
        {
          hasPowerBadge: boolean;
          powerBadgeText: string;
        }
      >
    >;
  };
}
