import { describe, expect, it } from "vitest";
import type { DocumentViewModel, NotesTemplate } from "../../model/types.js";
import { buildPdfNotes, deriveMonitorNoteContext } from "./buildPdfNotes.js";

const template: NotesTemplate = {
  id: "t",
  lang: "cs",
  inputs: [{ id: "always", text: "Vždy" }],
  monitors: [
    { id: "unconditional", text: "Bez podmínky" },
    { id: "wedge_only", text: "Wedge", when: { monitors: { hasWedge: true } } },
    {
      id: "band_iem",
      text: "Vlastní IEM",
      when: { monitors: { hasBandSuppliedIem: true } },
    },
    {
      id: "foh_iem",
      text: "FOH IEM",
      when: { monitors: { hasFohSuppliedIem: true } },
    },
    {
      id: "wedge_and_band_iem",
      text: "Wedge i vlastní IEM",
      when: { monitors: { hasWedge: true, hasBandSuppliedIem: true } },
    },
  ],
};

const NOTHING = {
  hasWedge: false,
  hasBandSuppliedIem: false,
  hasFohSuppliedIem: false,
};
const ids = (notes: { id: string }[]) => notes.map((n) => n.id);

describe("buildPdfNotes", () => {
  it("always keeps notes without a condition", () => {
    expect(
      ids(buildPdfNotes({ template, monitors: NOTHING }).monitors),
    ).toEqual(["unconditional"]);
  });

  it("keeps the band iem note only for band supplied iem", () => {
    const notes = buildPdfNotes({
      template,
      monitors: { ...NOTHING, hasBandSuppliedIem: true },
    });
    expect(ids(notes.monitors)).toEqual(["unconditional", "band_iem"]);
  });

  it("keeps both iem notes for a mixed lineup", () => {
    const notes = buildPdfNotes({
      template,
      monitors: {
        hasWedge: false,
        hasBandSuppliedIem: true,
        hasFohSuppliedIem: true,
      },
    });
    expect(ids(notes.monitors)).toEqual([
      "unconditional",
      "band_iem",
      "foh_iem",
    ]);
  });

  it("keeps the wedge note only when a wedge is present", () => {
    const notes = buildPdfNotes({
      template,
      monitors: { ...NOTHING, hasWedge: true },
    });
    expect(ids(notes.monitors)).toEqual(["unconditional", "wedge_only"]);
  });

  it("keeps a multi-flag note only when every listed flag is satisfied", () => {
    const notes = buildPdfNotes({
      template,
      monitors: { ...NOTHING, hasWedge: true, hasBandSuppliedIem: true },
    });
    expect(ids(notes.monitors)).toEqual([
      "unconditional",
      "wedge_only",
      "band_iem",
      "wedge_and_band_iem",
    ]);
  });

  it("hides a multi-flag note when only one of its required flags is satisfied (wedge)", () => {
    const notes = buildPdfNotes({
      template,
      monitors: { ...NOTHING, hasWedge: true },
    });
    expect(ids(notes.monitors)).not.toContain("wedge_and_band_iem");
  });

  it("hides a multi-flag note when only one of its required flags is satisfied (band iem)", () => {
    const notes = buildPdfNotes({
      template,
      monitors: { ...NOTHING, hasBandSuppliedIem: true },
    });
    expect(ids(notes.monitors)).not.toContain("wedge_and_band_iem");
  });

  it("passes input notes through untouched", () => {
    expect(ids(buildPdfNotes({ template, monitors: NOTHING }).inputs)).toEqual([
      "always",
    ]);
  });
});

const ALL_IEM = {
  hasWedge: false,
  hasBandSuppliedIem: true,
  hasFohSuppliedIem: false,
};

describe("buildPdfNotes project deviations", () => {
  it("drops a disabled template line", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: { disabled: ["always"] },
    });

    expect(ids(notes.inputs)).toEqual([]);
  });

  it("drops a disabled line even when a condition would show it", () => {
    const notes = buildPdfNotes({
      template,
      monitors: ALL_IEM,
      overrides: { disabled: ["band_iem"] },
    });

    expect(ids(notes.monitors)).toEqual(["unconditional"]);
  });

  it("replaces the text of a template line and keeps its id and position", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: { overrides: { always: "Jiné znění." } },
    });

    expect(notes.inputs).toEqual([{ id: "always", text: "Jiné znění." }]);
  });

  it("ignores an override for a line the condition hides", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: { overrides: { band_iem: "Nezobrazí se." } },
    });

    expect(ids(notes.monitors)).toEqual(["unconditional"]);
  });

  it("ignores an override for an id the template does not have", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: { overrides: { nonsense: "Nikam nepatří." } },
    });

    expect(ids(notes.inputs)).toEqual(["always"]);
    expect(ids(notes.monitors)).toEqual(["unconditional"]);
  });

  it("appends custom lines at the end of their own section", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: {
        custom: [
          { id: "custom_1", section: "inputs", text: "Vstupní věta." },
          { id: "custom_2", section: "monitors", text: "Monitorová věta." },
        ],
      },
    });

    expect(ids(notes.inputs)).toEqual(["always", "custom_1"]);
    expect(ids(notes.monitors)).toEqual(["unconditional", "custom_2"]);
  });

  it("keeps custom lines in their stored order", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: {
        custom: [
          { id: "custom_2", section: "inputs", text: "Druhá." },
          { id: "custom_1", section: "inputs", text: "První." },
        ],
      },
    });

    expect(ids(notes.inputs)).toEqual(["always", "custom_2", "custom_1"]);
  });

  it("keeps a custom line when an unrelated template line is disabled", () => {
    const notes = buildPdfNotes({
      template,
      monitors: NOTHING,
      overrides: {
        disabled: ["always"],
        custom: [{ id: "custom_1", section: "inputs", text: "Zůstane." }],
      },
    });

    expect(ids(notes.inputs)).toEqual(["custom_1"]);
  });

  it("treats an empty deviation object the same as no deviations at all", () => {
    expect(buildPdfNotes({ template, monitors: NOTHING })).toEqual(
      buildPdfNotes({ template, monitors: NOTHING, overrides: {} }),
    );
  });
});

// Task 17, Important 2 (review): extracted so `buildDocument.ts` and the
// `02 INPUTS` notes editor call the same derivation instead of each keeping
// their own copy of this logic.
describe("deriveMonitorNoteContext", () => {
  const monitor = (
    overrides: Partial<DocumentViewModel["monitors"][number]>,
  ): DocumentViewModel["monitors"][number] => ({
    id: "m1",
    label: "Monitor",
    kind: "wedge",
    supplier: "band",
    ...overrides,
  });

  it("reports every flag false for an empty monitor list", () => {
    expect(deriveMonitorNoteContext([])).toEqual(NOTHING);
  });

  it("sets hasWedge when any monitor is a wedge", () => {
    expect(deriveMonitorNoteContext([monitor({ kind: "wedge" })])).toEqual({
      ...NOTHING,
      hasWedge: true,
    });
  });

  it("sets hasBandSuppliedIem only for a band-supplied iem", () => {
    expect(
      deriveMonitorNoteContext([monitor({ kind: "iem", supplier: "band" })]),
    ).toEqual({ ...NOTHING, hasBandSuppliedIem: true });
  });

  it("sets hasFohSuppliedIem only for a foh-supplied iem", () => {
    expect(
      deriveMonitorNoteContext([monitor({ kind: "iem", supplier: "foh" })]),
    ).toEqual({ ...NOTHING, hasFohSuppliedIem: true });
  });

  it("does not set hasBandSuppliedIem for a foh-supplied iem, or vice versa", () => {
    expect(
      deriveMonitorNoteContext([monitor({ kind: "iem", supplier: "foh" })]),
    ).toEqual({
      ...NOTHING,
      hasFohSuppliedIem: true,
      hasBandSuppliedIem: false,
    });
  });

  it("combines flags across a mixed monitor lineup", () => {
    expect(
      deriveMonitorNoteContext([
        monitor({ kind: "wedge" }),
        monitor({ kind: "iem", supplier: "foh" }),
      ]),
    ).toEqual({
      hasWedge: true,
      hasBandSuppliedIem: false,
      hasFohSuppliedIem: true,
    });
  });
});
