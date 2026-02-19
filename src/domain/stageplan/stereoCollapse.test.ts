import { describe, expect, it } from "vitest";

import { formatStageplanInputLines } from "./stereoCollapse.js";

describe("formatStageplanInputLines", () => {
  it("aggregates stereo inputs into single stageplan bullet labels", () => {
    const lines = formatStageplanInputLines([
      { kind: "input", label: "Electric guitar L", no: 13, group: "guitar" },
      { kind: "input", label: "Electric guitar R", no: 14, group: "guitar" },
      { kind: "input", label: "Keys", no: 15, group: "keys" },
      { kind: "input", label: "Keys", no: 16, group: "keys" },
      { kind: "input", label: "Synth", no: 17, group: "keys" },
      { kind: "input", label: "Synth", no: 18, group: "keys" },
      { kind: "input", label: "Synth (mono)", no: 19, group: "keys" },
    ]);

    expect(lines.map((line) => line.text)).toEqual([
      "Electric guitar (13+14)",
      "Keys (15+16)",
      "Synth (17+18)",
      "Synth (mono) (19)",
    ]);
    expect(lines.map((line) => line.text).join(" ")).not.toContain("2x ");
  });
});
