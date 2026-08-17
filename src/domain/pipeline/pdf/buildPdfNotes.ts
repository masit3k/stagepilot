import type {
  DocumentViewModel,
  NoteLine,
  NotesTemplate,
  ProjectNotesOverride,
} from "../../model/types.js";

/**
 * Co? Stav odposlechů kapely, proti kterému se vyhodnocují podmínky poznámek.
 * Proč? Poznámka pod tabulkou musí odpovídat tomu, co kapela veze a co požaduje.
 */
export type MonitorNoteContext = {
  hasWedge: boolean;
  hasBandSuppliedIem: boolean;
  hasFohSuppliedIem: boolean;
};

/**
 * Poznámka bez `when` platí vždy. Poznámka s `when` platí, jen když
 * jsou splněny všechny uvedené příznaky (konjunkce) — žádný neznámý
 * ani nesplněný příznak ji nesmí tiše skrýt.
 */
function matchesCondition(
  note: NoteLine,
  monitors: MonitorNoteContext,
): boolean {
  if (!note.when) return true;
  const required = note.when.monitors;
  if (required.hasWedge === true && !monitors.hasWedge) return false;
  if (required.hasBandSuppliedIem === true && !monitors.hasBandSuppliedIem)
    return false;
  if (required.hasFohSuppliedIem === true && !monitors.hasFohSuppliedIem)
    return false;
  return true;
}

/**
 * Poznámky projektu vzniknou ve **čtyřech krocích a v tomto pořadí** (R11):
 * filtr podmínek, vyhození vypnutých, přepis textu, připojení vlastních.
 *
 * Pořadí není libovolné. Přepis se aplikuje až po filtru, takže přepsat řádek,
 * který podmínka skrývá, ho nezobrazí — editor to uživateli říká předem (R13).
 * Vlastní řádky se připojují nakonec, protože nesou vlastní text a žádné
 * podmínky se na ně nevztahují.
 */
function applySectionDeviations(
  lines: NoteLine[],
  section: "inputs" | "monitors",
  overrides: ProjectNotesOverride | undefined,
): NoteLine[] {
  if (!overrides) return lines;

  const disabled = new Set(overrides.disabled ?? []);
  const texts = overrides.overrides ?? {};

  const kept = lines
    .filter((note) => !disabled.has(note.id))
    .map((note) =>
      typeof texts[note.id] === "string"
        ? { ...note, text: texts[note.id] }
        : note,
    );

  const custom = (overrides.custom ?? [])
    .filter((entry) => entry.section === section)
    .map((entry) => ({ id: entry.id, text: entry.text }));

  return [...kept, ...custom];
}

export function buildPdfNotes(args: {
  template: NotesTemplate;
  monitors: MonitorNoteContext;
  overrides?: ProjectNotesOverride;
}): DocumentViewModel["notes"] {
  const { template, monitors, overrides } = args;

  return {
    inputs: applySectionDeviations(
      template.inputs ?? [],
      "inputs",
      overrides,
    ),
    monitors: applySectionDeviations(
      (template.monitors ?? []).filter((note) =>
        matchesCondition(note, monitors),
      ),
      "monitors",
      overrides,
    ),
  };
}
