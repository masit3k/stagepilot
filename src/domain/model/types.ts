// src/domain/model/types.ts
// Co? Typové definice doménových entit a výstupního view modelu.
// Proč? Musí odpovídat reálným JSONům, jinak se rozbije pipeline i TS kontrola.

import type { Group } from "./groups.js";
export type { Group } from "./groups.js";

/** Projekt = konkrétní akce (instance), pro kterou generujeme dokumenty. */
export interface Project {
  id: string;
  bandRef: string; // band.id
  date: string; // ISO "YYYY-MM-DD"
  venue?: string;
}

/** Lineup: pro danou skupinu může být jeden muzikant nebo více muzikantů. */
export type LineupValue = string | string[];

/** Default lineup kapely: group -> musicianId(s). */
export type DefaultLineup = Partial<Record<Group, LineupValue>>;

/** Kapela: statická definice (knihovna). */
export interface Band {
  id: string;
  code?: string;
  name: string;

  /** Výchozí obsazení kapely pro generování (group -> musicianId(s)). */
  defaultLineup: DefaultLineup;

  defaultContactId?: string;

  /** Volitelné: reference na notes template */
  notesTemplateRef?: string;
}

/** Muzikant: profil osoby a reference na presety, které používá. */
export interface Musician {
  id: string;
  firstName: string;
  lastName: string;
  group: Group;
  contactRef?: string;

  /** V2: explicitní položky s discriminator `kind` */
  presets: PresetItem[];
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
  requirements?: unknown;
}

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

export type NoteCondition =
  | { monitors: { hasWedge: true } };

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

/** Výstup pipeline – připraveno pro render (PDF) nebo export. */
export interface DocumentViewModel {
  meta: {
    projectId: string;
    bandName: string;
    date: string;
    venue?: string;
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
}