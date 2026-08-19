import type {
  NoteLine,
  NotesTemplate,
  ProjectNotesOverride,
} from "../../../../../../src/domain/model/types";
import type { MonitorNoteContext } from "../../../../../../src/domain/pipeline/pdf/buildPdfNotes";

export type NotesEditorLine = {
  readonly id: string;
  readonly text: string;
  readonly source: "template" | "custom";
  readonly enabled: boolean;
  readonly edited: boolean;
  readonly hidden: boolean;
  readonly hiddenReason: string | null;
};

export type NotesEditorModel = {
  readonly inputs: NotesEditorLine[];
  readonly monitors: NotesEditorLine[];
};

/**
 * Task 17, Ruling 1 (dispatch notes): tahle tabulka nesmí být ruční opis
 * `matchesCondition` z `buildPdfNotes.ts` — je to `Record` nad
 * `keyof MonitorNoteContext`, takže přidání čtvrtého flagu do
 * `MonitorNoteContext` shodí `tsc` přímo tady, dokud pro něj editor nedostane
 * i hlášku. Bez téhle vazby by editor u nového flagu tiše řekl „není
 * skrytý", zatímco `buildPdfNotes` by řádek zahodil — přesně ta divergence
 * editor↔dokument, kvůli které se tenhle task měřil.
 *
 * Pořadí klíčů odpovídá pořadí, v jakém `matchesCondition` testuje příznaky
 * (`hasWedge`, pak `hasBandSuppliedIem`, pak `hasFohSuppliedIem`) — nečíselné
 * string klíče drží v JS pořadí deklarace, takže `Object.keys` níž vrátí
 * totéž pořadí a `hiddenReasonFor` ohlásí tu podmínku, na které by řádek
 * doopravdy padl jako první.
 */
const HIDDEN_REASON: Record<keyof MonitorNoteContext, string> = {
  hasWedge: "Hidden: band uses no wedges",
  hasBandSuppliedIem: "Hidden: band brings no IEM",
  hasFohSuppliedIem: "Hidden: band has no FOH-supplied IEM",
};

const HIDDEN_REASON_FLAGS = Object.keys(
  HIDDEN_REASON,
) as (keyof MonitorNoteContext)[];

function hiddenReasonFor(
  note: NoteLine,
  monitors: MonitorNoteContext,
): string | null {
  const required = note.when?.monitors;
  if (!required) return null;

  for (const flag of HIDDEN_REASON_FLAGS) {
    if (required[flag] === true && !monitors[flag]) return HIDDEN_REASON[flag];
  }
  return null;
}

function resolveSection(
  lines: readonly NoteLine[],
  section: "inputs" | "monitors",
  monitors: MonitorNoteContext,
  overrides: ProjectNotesOverride | undefined,
): NotesEditorLine[] {
  const disabled = new Set(overrides?.disabled ?? []);
  const texts = overrides?.overrides ?? {};

  const fromTemplate = lines.map((note) => {
    const reason = hiddenReasonFor(note, monitors);
    const override = texts[note.id];

    return {
      id: note.id,
      text: typeof override === "string" ? override : note.text,
      source: "template" as const,
      enabled: !disabled.has(note.id),
      edited: typeof override === "string",
      hidden: reason !== null,
      hiddenReason: reason,
    };
  });

  const custom = (overrides?.custom ?? [])
    .filter((entry) => entry.section === section)
    .map((entry) => ({
      id: entry.id,
      text: entry.text,
      source: "custom" as const,
      enabled: !disabled.has(entry.id),
      edited: false,
      hidden: false,
      hiddenReason: null,
    }));

  return [...fromTemplate, ...custom];
}

/**
 * Co? Model editoru poznámek.
 *
 * Proč se liší od `buildPdfNotes`? Editor ukazuje **všechny** řádky šablony,
 * i ty, které podmínka skrývá, a u skrytých říká proč (R13). `buildPdfNotes`
 * je naopak zahodí — do dokumentu nepatří. Bez toho rozdílu by uživatel psal
 * text do řádku, který se nikdy nevytiskne, a nedozvěděl by se to.
 */
export function resolveNotesEditorModel(args: {
  template: NotesTemplate;
  monitors: MonitorNoteContext;
  overrides: ProjectNotesOverride | undefined;
}): NotesEditorModel {
  const { template, monitors, overrides } = args;

  return {
    inputs: resolveSection(
      template.inputs ?? [],
      "inputs",
      monitors,
      overrides,
    ),
    monitors: resolveSection(
      template.monitors ?? [],
      "monitors",
      monitors,
      overrides,
    ),
  };
}

/**
 * Task 17, Ruling 2 (dispatch notes): další volné `custom_<n>` (R11) se hledá
 * proti VŠEM id v projektu — šablonovým i vlastním, v obou sekcích — ne jen
 * proti ostatním vlastním řádkům. `normalizeProjectNotes` nevynucuje
 * dokumentovanou invariantu prefixu `custom_` a nic dál po cestě
 * nededuplikuje podle id, takže kolize `custom_<n>` se jménem řádku šablony
 * by řádek zdvojila, ne přepsala. `model.inputs`/`model.monitors` už obě
 * sekce i oba zdroje (`template` i `custom`) spojují, takže stačí sjednotit
 * jejich id do jedné množiny.
 */
export function nextCustomNoteId(model: NotesEditorModel): string {
  const usedIds = new Set(
    [...model.inputs, ...model.monitors].map((line) => line.id),
  );
  let n = 1;
  while (usedIds.has(`custom_${n}`)) n += 1;
  return `custom_${n}`;
}

/** Zapíše/zruší vypnutí řádku (šablonového i vlastního) v `disabled`. */
export function setNoteEnabled(
  overrides: ProjectNotesOverride | undefined,
  id: string,
  enabled: boolean,
): ProjectNotesOverride | undefined {
  const disabled = new Set(overrides?.disabled ?? []);
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  return withOverrideFields(overrides, { disabled: [...disabled] });
}

/**
 * Přepíše text šablonového řádku (R12). Pro vlastní řádek (`custom`) text
 * žije přímo v `custom[].text`, ne tady — volající rozlišuje podle
 * `line.source` a v tom případě volá `setCustomNoteText`.
 */
export function setTemplateNoteText(
  overrides: ProjectNotesOverride | undefined,
  id: string,
  text: string,
): ProjectNotesOverride | undefined {
  return withOverrideFields(overrides, {
    overrides: { ...overrides?.overrides, [id]: text },
  });
}

/** Zahodí přepis textu šablonového řádku — vrátí ho na znění ze šablony. */
export function revertNoteToTemplate(
  overrides: ProjectNotesOverride | undefined,
  id: string,
): ProjectNotesOverride | undefined {
  const texts = { ...overrides?.overrides };
  delete texts[id];
  return withOverrideFields(overrides, { overrides: texts });
}

/** Přepíše text vlastního řádku projektu. */
export function setCustomNoteText(
  overrides: ProjectNotesOverride | undefined,
  id: string,
  text: string,
): ProjectNotesOverride | undefined {
  const custom = (overrides?.custom ?? []).map((entry) =>
    entry.id === id ? { ...entry, text } : entry,
  );
  return withOverrideFields(overrides, { custom });
}

/** Přidá nový vlastní řádek s dalším volným id (R11, Ruling 2). */
export function addCustomNote(
  overrides: ProjectNotesOverride | undefined,
  model: NotesEditorModel,
  section: "inputs" | "monitors",
): ProjectNotesOverride | undefined {
  const id = nextCustomNoteId(model);
  const custom = [...(overrides?.custom ?? []), { id, section, text: "" }];
  return withOverrideFields(overrides, { custom });
}

/**
 * Sloučí jedno pole do `overrides` a vynechá prázdné výsledné kolekce, stejná
 * konvence jako `normalizeProjectNotes` (`src/app/usecases/normalizeProject.ts`)
 * a `toggleInputRow.ts`'s `withInputs` — uložený projekt tak nenese šum
 * prázdných polí/objektů.
 */
function withOverrideFields(
  overrides: ProjectNotesOverride | undefined,
  next: {
    disabled?: readonly string[];
    overrides?: Readonly<Record<string, string>>;
    custom?: readonly {
      readonly id: string;
      readonly section: "inputs" | "monitors";
      readonly text: string;
    }[];
  },
): ProjectNotesOverride | undefined {
  const disabled = next.disabled ?? overrides?.disabled ?? [];
  const texts = next.overrides ?? overrides?.overrides ?? {};
  const custom = next.custom ?? overrides?.custom ?? [];

  const hasAnything =
    disabled.length > 0 || Object.keys(texts).length > 0 || custom.length > 0;
  if (!hasAnything) return undefined;

  return {
    ...(disabled.length > 0 ? { disabled } : {}),
    ...(Object.keys(texts).length > 0 ? { overrides: texts } : {}),
    ...(custom.length > 0 ? { custom } : {}),
  };
}
