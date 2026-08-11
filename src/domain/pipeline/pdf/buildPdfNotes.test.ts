import { describe, expect, it } from "vitest";
import type { NotesTemplate } from "../../model/types.js";
import { buildPdfNotes } from "./buildPdfNotes.js";

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

  it("passes input notes through untouched", () => {
    expect(ids(buildPdfNotes({ template, monitors: NOTHING }).inputs)).toEqual([
      "always",
    ]);
  });
});
