import { describe, expect, it } from "vitest";
import {
  type PdfInputChannelForCompaction,
  compactStereoInputChannelsForPdf,
  formatInputListNote,
  resolveStereoPair,
} from "./inputlist.js";

function input(
  ch: number,
  label: string,
  note?: string,
  extras: Partial<PdfInputChannelForCompaction> = {},
): PdfInputChannelForCompaction {
  return {
    ch,
    key: label.toLowerCase().replace(/\s+/g, "_"),
    label,
    note,
    ...extras,
  };
}

describe("input list formatters", () => {
  it("prefixes notes for collapsed rows", () => {
    expect(formatInputListNote("stereo DI", 2)).toBe("2x stereo DI");
    expect(formatInputListNote("2x stereo DI", 2)).toBe("2x stereo DI");
  });

  it("preserves parenthetical note suffixes", () => {
    expect(
      formatInputListNote(
        "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)",
        1,
      ),
    ).toBe("BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)");
  });

  it("resolves stereo pair from key suffix and keeps OH uncollapsed for channel numbering", () => {
    expect(
      resolveStereoPair(
        { key: "dr_oh_l", label: "OH L", group: "drums", note: "cond" },
        { key: "dr_oh_r", label: "OH R", group: "drums", note: "cond" },
      ),
    ).toEqual({ base: "OH", aSide: "L", shouldCollapse: false });
  });
});

describe("compactStereoInputChannelsForPdf", () => {
  it("compacts electric guitar stereo metadata", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Electric guitar L", "XLR out from pedalboard", {
          baseLabel: "Electric guitar",
          compactGroupKey: "eg1",
          channel: "L",
        }),
        input(2, "Electric guitar R", "XLR out from pedalboard", {
          baseLabel: "Electric guitar",
          compactGroupKey: "eg1",
          channel: "R",
        }),
      ]),
    ).toEqual([
      {
        no: "1+2",
        label: "Electric guitar",
        note: "2x XLR out from pedalboard",
      },
    ]);
  });

  it("compacts keys stereo metadata", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Keys L", "XLR out from rack", {
          baseLabel: "Keys",
          compactGroupKey: "keys1",
          channel: "L",
        }),
        input(2, "Keys R", "XLR out from rack", {
          baseLabel: "Keys",
          compactGroupKey: "keys1",
          channel: "R",
        }),
      ]),
    ).toEqual([{ no: "1+2", label: "Keys", note: "2x XLR out from rack" }]);
  });

  it("compacts generated PAD stereo metadata", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "PAD SFX L", "TS jack 6.3mm – DI box", {
          baseLabel: "PAD",
          compactGroupKey: "pad1",
          channel: "L",
        }),
        input(2, "PAD SFX R", "TS jack 6.3mm – DI box", {
          baseLabel: "PAD",
          compactGroupKey: "pad1",
          channel: "R",
        }),
      ]),
    ).toEqual([{ no: "1+2", label: "PAD", note: "2x TS jack 6.3mm – DI box" }]);
  });

  it("does not compact invalid stereo data when notes differ", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Electric guitar L", "XLR out from pedalboard", {
          baseLabel: "Electric guitar",
          compactGroupKey: "eg1",
          channel: "L",
        }),
        input(2, "Electric guitar R", "XLR out from amp", {
          baseLabel: "Electric guitar",
          compactGroupKey: "eg1",
          channel: "R",
        }),
      ]),
    ).toEqual([
      { no: "1", label: "Electric guitar L", note: "XLR out from pedalboard" },
      { no: "2", label: "Electric guitar R", note: "XLR out from amp" },
    ]);
  });

  it("does not compact when compactGroupKey differs", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Keys L", "XLR out from rack", {
          baseLabel: "Keys",
          compactGroupKey: "keys1",
          channel: "L",
        }),
        input(2, "Keys R", "XLR out from rack", {
          baseLabel: "Keys",
          compactGroupKey: "keys2",
          channel: "R",
        }),
      ]),
    ).toHaveLength(2);
  });

  it("does not compact without compactGroupKey", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Keys L", "XLR out from rack", {
          baseLabel: "Keys",
          channel: "L",
        }),
        input(2, "Keys R", "XLR out from rack", {
          baseLabel: "Keys",
          channel: "R",
        }),
      ]),
    ).toHaveLength(2);
  });

  it("does not compact when channel metadata is missing or invalid", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Keys L", "XLR out from rack", {
          baseLabel: "Keys",
          compactGroupKey: "keys1",
        }),
        input(2, "Keys R", "XLR out from rack", {
          baseLabel: "Keys",
          compactGroupKey: "keys1",
          channel: "right",
        }),
      ]),
    ).toHaveLength(2);
  });

  it("preserves order around compacted rows", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Bass", "XLR out"),
        input(2, "Electric guitar L", "XLR out from pedalboard", {
          baseLabel: "Electric guitar",
          compactGroupKey: "eg1",
          channel: "L",
        }),
        input(3, "Electric guitar R", "XLR out from pedalboard", {
          baseLabel: "Electric guitar",
          compactGroupKey: "eg1",
          channel: "R",
        }),
        input(4, "Vocal", "SM58"),
      ]),
    ).toEqual([
      { no: "1", label: "Bass", note: "XLR out" },
      {
        no: "2+3",
        label: "Electric guitar",
        note: "2x XLR out from pedalboard",
      },
      { no: "4", label: "Vocal", note: "SM58" },
    ]);
  });

  it("does not compact across owners", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Keys L", "XLR out from rack", {
          baseLabel: "Keys",
          compactGroupKey: "keys1",
          channel: "L",
          ownerMusicianId: "a",
        }),
        input(2, "Keys R", "XLR out from rack", {
          baseLabel: "Keys",
          compactGroupKey: "keys1",
          channel: "R",
          ownerMusicianId: "b",
        }),
      ]),
    ).toHaveLength(2);
  });

  it("puts 2x only in the note column", () => {
    const [row] = compactStereoInputChannelsForPdf([
      input(1, "Keys L", "XLR out from rack", {
        baseLabel: "Keys",
        compactGroupKey: "keys1",
        channel: "L",
      }),
      input(2, "Keys R", "XLR out from rack", {
        baseLabel: "Keys",
        compactGroupKey: "keys1",
        channel: "R",
      }),
    ]);
    expect(row?.label.startsWith("2x")).toBe(false);
    expect(row?.note).toBe("2x XLR out from rack");
  });

  it("compacts synthetic future stereo sources from metadata", () => {
    expect(
      compactStereoInputChannelsForPdf([
        input(1, "Stereo bass L", "XLR out", {
          baseLabel: "Bass synth",
          compactGroupKey: "future1",
          channel: "L",
        }),
        input(2, "Stereo bass R", "XLR out", {
          baseLabel: "Bass synth",
          compactGroupKey: "future1",
          channel: "R",
        }),
      ]),
    ).toEqual([{ no: "1+2", label: "Bass synth", note: "2x XLR out" }]);
  });
});
