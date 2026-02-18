import { describe, expect, it } from "vitest";
import type { Preset } from "../../../../../../../../src/domain/model/types";
import { buildLeadVocsFields } from "./buildLeadVocsFields";

const presets = [
  { type: "preset", id: "vocal_lead_wireless", label: "Wireless", group: "vocs", inputs: [{ key: "voc_lead_wireless", label: "Lead" }] },
  { type: "preset", id: "vocal_lead_wired", label: "Wired", group: "vocs", inputs: [{ key: "voc_lead_wired", label: "Lead" }] },
  { type: "preset", id: "vocal_lead_no_mic", label: "No mic", group: "vocs", inputs: [{ key: "voc_lead_no_mic", label: "Lead" }] },
] as Preset[];

describe("buildLeadVocsFields", () => {
  it("keeps exact dropdown option order", () => {
    const field = buildLeadVocsFields(presets).find((item) => item.kind === "dropdown");
    if (!field || field.kind !== "dropdown") throw new Error("missing");
    expect(field.options({ defaultPreset: { inputs: [], monitoring: { monitorRef: "wedge" } }, effectivePreset: { inputs: [], monitoring: { monitorRef: "wedge" } } }).map((item) => item.label)).toEqual([
      "Own wireless mic",
      "Own wired mic",
      "No own mic",
    ]);
  });
});
