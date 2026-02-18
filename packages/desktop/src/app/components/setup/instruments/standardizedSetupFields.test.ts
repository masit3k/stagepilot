import { describe, expect, it } from "vitest";
import { applyPresetOverride } from "../../../../../../../src/domain/rules/presetOverride";
import type { MusicianSetupPreset, Preset } from "../../../../../../../src/domain/model/types";
import { buildGuitarFields } from "./guitar/buildGuitarFields";
import { buildLeadVocsFields } from "./vocs/buildLeadVocsFields";
import { buildKeysFields } from "./keys/buildKeysFields";
import elGuitarMicPreset from "../../../../../../../data/assets/presets/groups/guitar/el_guitar_mic.json";
import elGuitarXlrMonoPreset from "../../../../../../../data/assets/presets/groups/guitar/el_guitar_xlr_mono.json";
import elGuitarXlrStereoPreset from "../../../../../../../data/assets/presets/groups/guitar/el_guitar_xlr_stereo.json";
import acGuitarPreset from "../../../../../../../data/assets/presets/groups/guitar/ac_guitar.json";
import vocalLeadWirelessPreset from "../../../../../../../data/assets/presets/groups/vocs/vocal_lead_wireless.json";
import vocalLeadWiredPreset from "../../../../../../../data/assets/presets/groups/vocs/vocal_lead_wired.json";
import vocalLeadNoMicPreset from "../../../../../../../data/assets/presets/groups/vocs/vocal_lead_no_mic.json";
import keysPreset from "../../../../../../../data/assets/presets/groups/keys/keys.json";
import synthPreset from "../../../../../../../data/assets/presets/groups/keys/synth.json";
import synthMonoPreset from "../../../../../../../data/assets/presets/groups/keys/synth_mono.json";

describe("standardized setup fields", () => {
  it("keeps guitar dropdown interactive when mic-on-cab is enabled", () => {
    const fields = buildGuitarFields([elGuitarMicPreset, elGuitarXlrMonoPreset, elGuitarXlrStereoPreset, acGuitarPreset] as Preset[]);
    const connection = fields.find((field) => field.kind === "dropdown");
    if (!connection || connection.kind !== "dropdown") throw new Error("missing guitar connection field");

    const defaultPreset: MusicianSetupPreset = {
      inputs: [{ key: "el_guitar_mic", label: "Electric guitar", note: "Mic", group: "guitar" }],
      monitoring: { monitorRef: "wedge" },
    };
    const patch = connection.setValue({ defaultPreset, effectivePreset: defaultPreset }, "el_guitar_xlr_mono");
    const effective = applyPresetOverride(defaultPreset, patch);
    expect(connection.getValue({ defaultPreset, effectivePreset: effective, patch })).toBe("el_guitar_xlr_mono");
  });

  it("updates lead vocal mode by patching lead input metadata", () => {
    const fields = buildLeadVocsFields([vocalLeadWirelessPreset, vocalLeadWiredPreset, vocalLeadNoMicPreset] as Preset[]);
    const micField = fields.find((field) => field.kind === "dropdown");
    if (!micField || micField.kind !== "dropdown") throw new Error("missing lead voc field");

    const defaultPreset: MusicianSetupPreset = {
      inputs: [{ key: "voc_lead", label: "Lead vocal", note: "Own wireless mic – boom mic stand", group: "vocs" }],
      monitoring: { monitorRef: "wedge" },
    };
    const patch = micField.setValue({ defaultPreset, effectivePreset: defaultPreset }, "vocal_lead_wired");
    expect(patch?.inputs?.update?.[0]?.key).toBe("voc_lead");

    const effective = applyPresetOverride(defaultPreset, patch);
    expect(micField.getValue({ defaultPreset, effectivePreset: effective, patch })).toBe("vocal_lead_wired");
  });

  it("never allows zero manuals for keys row", () => {
    const fields = buildKeysFields([keysPreset, synthPreset, synthMonoPreset] as Preset[]);
    const toggleGrid = fields.find((field) => field.kind === "toggleGrid");
    if (!toggleGrid || toggleGrid.kind !== "toggleGrid") throw new Error("missing keys toggle grid");
    const keysField = toggleGrid.fields[0];

    const defaultPreset: MusicianSetupPreset = {
      inputs: [],
      monitoring: { monitorRef: "wedge" },
    };
    const patch = keysField.setValue({ defaultPreset, effectivePreset: defaultPreset }, false);
    const effective = applyPresetOverride(defaultPreset, patch);
    const keyInputs = effective.inputs.filter((item) => item.key.startsWith("keys"));

    expect(keysField.getValue({ defaultPreset, effectivePreset: effective, patch })).toBe(true);
    expect(keyInputs.length).toBeGreaterThan(0);
  });
});
