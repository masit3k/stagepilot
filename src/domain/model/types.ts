// src/domain/model/types.ts
// Co? Typové definice doménových entit a výstupního view modelu.
// Proč? Musí odpovídat reálným JSONům, jinak se rozbije pipeline i TS kontrola.

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
  firstName: string | null;
  isBandLeader: boolean;
};

/**
 * Normalizovaný doménový projekt (po načtení a normalizaci z JSONu).
 * Tohle má používat pipeline.
 */
export interface Project {
  id: string;
  bandRef: string; // band.id

  purpose: StagePlanPurpose;

  /** Datum konání akce (jen pro purpose="event") */
  eventDate?: string; // ISO "YYYY-MM-DD"

  /** Místo konání akce (jen pro purpose="event") */
  eventVenue?: string;

  /** Datum vytvoření/aktualizace dokumentu (vždy) */
  documentDate: string; // ISO "YYYY-MM-DD"

  /** Název projektu (tour/sezóna/poznámka), typicky pro purpose="generic" */
  title?: string;

  /** Volitelně: volba template/layoutu */
  template?: string;

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
  bandRef: string;

  purpose: StagePlanPurpose;

  eventDate?: string;
  eventVenue?: string;

  documentDate: string;
  title?: string;
  template?: string;
  stageplan?: {
    powerOverridesByMusician?: Record<string, PowerRequirement>;
  };
}

/**
 * Projekt v JSONu může být dočasně legacy nebo V2.
 * Loader má zodpovědnost sjednotit na `Project`.
 */
export type ProjectJson = LegacyProjectJson | ProjectJsonV2;

/** Lineup: pro danou skupinu může být jeden muzikant nebo více muzikantů. */
export type LineupValue = string | string[];

/** Default lineup kapely: group -> musicianId(s). */
export type DefaultLineup = Partial<Record<Group, LineupValue>>;

/** Kapela: statická definice (knihovna). */
export interface Band {
  id: string;
  code?: string;
  name: string;

  bandLeader: string;

  /** Výchozí obsazení kapely pro generování (group -> musicianId(s)). */
  defaultLineup: DefaultLineup;

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
      kind: "vocal";
      ref: string;
      ownerKey: string;
      ownerLabel?: string;
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
  key: string;
  label: string;
  group?: Group; // když chybí, doplní se podle lineup group
  note?: string;
}

/** FOH preset: sada inputů pro jednu část setupu (např. drums standard 9). */
export interface Preset {
  type: "preset" | "kit" | "feature";
  id: string;
  label: string;
  group: Group;
  inputs: InputChannel[];
}

export type PowerRequirement = {
  voltage: number;
  sockets: number;
};

/** Vocal "typ" – šablona, ze které se generuje jeden input. */
export interface VocalType {
  type: "vocal_type";
  id: string;
  label: string;
  group: Group; // typicky "vocs"
  input: {
    key: string; // např. "voc_{vocalKey}"
    label: string; // "{vocalLabel}"
    note?: string; // "{vocalNote}"
  };
}

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
  };
}

/** Monitor mix typ (zatím se nepromítá do FOH input listu). */
export interface Monitor {
  type: "monitor";
  id: string;
  label: string;
  mode?: "mono" | "stereo";
  wireless?: boolean;
}

/** Union všech entit v data/presets */
export type PresetEntity = Preset | VocalType | TalkbackType | Monitor;

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
    title?: string;

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
    group: Group;
    note?: string;
  }>;

  /**
   * View-only řádky pro Input list (to, co se tiskne do tabulky).
   * Umožňuje sloučení stereo párů do formátu "13+14" bez toho, aby se měnila kanonická data.
   */
  inputRows: Array<{
    no: string;
    label: string;
    note?: string;
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

  stageplan: {
    lineupByRole: Partial<Record<StageplanInstrumentKey, StageplanPerson>>;
    inputs: Array<{
      channelNo: number;
      label: string;
      group: Group;
    }>;
    monitorOutputs: Array<{
      no: number;
      output: string;
      note: string;
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
