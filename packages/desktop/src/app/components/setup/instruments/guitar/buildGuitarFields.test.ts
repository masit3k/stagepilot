import { describe, expect, it } from "vitest";
import type { Preset } from "../../../../../../../../src/domain/model/types";
import { buildGuitarFields } from "./buildGuitarFields";

const presets: Preset[] = [
  { type: "preset", id: "el_guitar_mic", label: "Electric guitar (mic)", group: "guitar", inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }] },
  { type: "preset", id: "el_guitar_xlr_mono", label: "Electric guitar (XLR mono)", group: "guitar", inputs: [{ key: "el_guitar_xlr_mono", label: "Electric guitar" }] },
  { type: "preset", id: "el_guitar_xlr_stereo", label: "Electric guitar (XLR stereo)", group: "guitar", inputs: [{ key: "el_guitar_xlr_stereo_l", label: "Electric guitar L" }, { key: "el_guitar_xlr_stereo_r", label: "Electric guitar R" }] },
  { type: "preset", id: "ac_guitar", label: "Acoustic guitar", group: "guitar", inputs: [{ key: "ac_guitar", label: "Acoustic guitar" }] },
] as Preset[];

describe("buildGuitarFields", () => {
  it("keeps exact connection option order", () => {
    const field = buildGuitarFields(presets).find((item) => item.kind === "dropdown");
    if (!field || field.kind !== "dropdown") throw new Error("missing field");
    expect(field.options({ defaultPreset: { inputs: [], monitoring: { monitorRef: "wedge" } }, effectivePreset: { inputs: [], monitoring: { monitorRef: "wedge" } } }).map((item) => item.label)).toEqual([
      "Electric guitar (mic)",
      "Electric guitar (XLR mono)",
      "Electric guitar (XLR stereo)",
    ]);
  });
});
