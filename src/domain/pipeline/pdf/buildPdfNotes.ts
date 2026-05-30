import type {
  DocumentViewModel,
  NoteLine,
  NotesTemplate,
} from "../../model/types.js";

function filterNotesMonitors(notes: NoteLine[], hasWedge: boolean): NoteLine[] {
  return notes.filter((n) => {
    if (!n.when) return true;
    if ("monitors" in n.when) {
      if (n.when.monitors.hasWedge === true) return hasWedge === true;
    }
    return false;
  });
}

export function buildPdfNotes(args: {
  template: NotesTemplate;
  hasWedge: boolean;
}): DocumentViewModel["notes"] {
  const { template, hasWedge } = args;
  return {
    inputs: template.inputs ?? [],
    monitors: filterNotesMonitors(template.monitors ?? [], hasWedge),
  };
}
