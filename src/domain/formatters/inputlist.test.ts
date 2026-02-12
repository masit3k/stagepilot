import { describe, expect, it } from "vitest";
import { formatInputListLabel, formatInputListNote, resolveStereoPair } from "./inputlist.js";

describe("input list formatters", () => {
  it("collapses identical stereo labels", () => {
    expect(formatInputListLabel("Keys L", "Keys R")).toBe("Keys");
  });

  it("normalizes nested side markers", () => {
    expect(formatInputListLabel("Sample pad L (main out L)", "Sample pad R (main out R)")).toBe(
      "Sample pad (main out)"
    );
  });

  it("prefixes notes for collapsed rows", () => {
    expect(formatInputListNote("stereo DI", 2)).toBe("2x stereo DI");
    expect(formatInputListNote("2x stereo DI", 2)).toBe("2x stereo DI");
  });

  it("resolves stereo pair from key suffix and keeps OH uncollapsed", () => {
    expect(
      resolveStereoPair(
        { key: "dr_oh_l", label: "OH L", group: "drums", note: "cond" },
        { key: "dr_oh_r", label: "OH R", group: "drums", note: "cond" }
      )
    ).toEqual({ base: "OH", aSide: "L", shouldCollapse: false });
  });
});
