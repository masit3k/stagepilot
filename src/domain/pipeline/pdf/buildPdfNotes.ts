import type {
  DocumentViewModel,
  NoteLine,
  NotesTemplate,
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

export function buildPdfNotes(args: {
  template: NotesTemplate;
  monitors: MonitorNoteContext;
}): DocumentViewModel["notes"] {
  const { template, monitors } = args;
  return {
    inputs: template.inputs ?? [],
    monitors: (template.monitors ?? []).filter((note) =>
      matchesCondition(note, monitors),
    ),
  };
}
