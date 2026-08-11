import { describe, expect, it } from "vitest";
import type { Preset } from "../../../../../../../../src/domain/model/types";
import { buildLeadVocsFields } from "./buildLeadVocsFields";

const presets = [
  { type: "preset", id: "vocal_wireless", label: "Wireless", group: "vocs", inputs: [{ key: "voc_input", label: "Vocal" }] },
  { type: "preset", id: "vocal_wired", label: "Wired", group: "vocs", inputs: [{ key: "voc_input", label: "Vocal" }] },
  { type: "preset", id: "vocal_no_mic", label: "No mic", group: "vocs", inputs: [{ key: "voc_input", label: "Vocal" }] },
] as Preset[];

describe("buildLeadVocsFields", () => {
  it("keeps exact dropdown option order", () => {
    const field = buildLeadVocsFields(presets).find((item) => item.kind === "dropdown");
    if (!field || field.kind !== "dropdown") throw new Error("missing");
    expect(field.options({ defaultPreset: { inputs: [], monitoring: { monitorRef: "wedge_foh" } }, effectivePreset: { inputs: [], monitoring: { monitorRef: "wedge_foh" } } }).map((item) => item.label)).toEqual([
      "Own wireless mic",
      "Own wired mic",
      "No own mic",
    ]);
  });
});
