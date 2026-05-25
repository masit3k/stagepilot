import { describe, expect, it } from "vitest";
import acGuitarPreset from "../../../../../../../data/assets/presets/groups/guitar/ac_guitar.json";
import elGuitarMicPreset from "../../../../../../../data/assets/presets/groups/guitar/el_guitar_mic.json";
import elGuitarXlrMonoPreset from "../../../../../../../data/assets/presets/groups/guitar/el_guitar_xlr_mono.json";
import elGuitarXlrStereoPreset from "../../../../../../../data/assets/presets/groups/guitar/el_guitar_xlr_stereo.json";
import keysMonoJackPreset from "../../../../../../../data/assets/presets/groups/keys/keys_mono_jack.json";
import keysMonoXlrPreset from "../../../../../../../data/assets/presets/groups/keys/keys_mono_xlr.json";
import keysStereoJackPreset from "../../../../../../../data/assets/presets/groups/keys/keys_stereo_jack.json";
import keysStereoXlrPreset from "../../../../../../../data/assets/presets/groups/keys/keys_stereo_xlr.json";
import vocalNoMicPreset from "../../../../../../../data/assets/presets/groups/vocs/vocal_no_mic.json";
import vocalWiredPreset from "../../../../../../../data/assets/presets/groups/vocs/vocal_wired.json";
import vocalWirelessPreset from "../../../../../../../data/assets/presets/groups/vocs/vocal_wireless.json";
import type {
  MusicianSetupPreset,
  Preset,
} from "../../../../../../../src/domain/model/types";
import { applyPresetOverride } from "../../../../../../../src/domain/rules/presetOverride";
import { buildGuitarFields } from "./guitar/buildGuitarFields";
import { buildKeysFields } from "./keys/buildKeysFields";
import { buildLeadVocsFields } from "./vocs/buildLeadVocsFields";

describe("standardized setup fields", () => {
  it("keeps guitar dropdown interactive when mic-on-cab is enabled", () => {
    const fields = buildGuitarFields([
      elGuitarMicPreset,
      elGuitarXlrMonoPreset,
      elGuitarXlrStereoPreset,
      acGuitarPreset,
    ] as Preset[]);
    const connection = fields.find((field) => field.kind === "dropdown");
    if (!connection || connection.kind !== "dropdown")
      throw new Error("missing guitar connection field");

    const defaultPreset: MusicianSetupPreset = {
      inputs: [
        {
          key: "el_guitar_mic",
          label: "Electric guitar",
          note: "Mic",
          group: "guitar",
        },
      ],
      monitoring: { monitorRef: "wedge" },
    };
    const patch = connection.setValue(
      { defaultPreset, effectivePreset: defaultPreset },
      "el_guitar_xlr_mono",
    );
    const effective = applyPresetOverride(defaultPreset, patch);
    expect(
      connection.getValue({ defaultPreset, effectivePreset: effective, patch }),
    ).toBe("el_guitar_xlr_mono");
  });

  it("updates lead vocal mode by patching lead input metadata", () => {
    const fields = buildLeadVocsFields([
      vocalWirelessPreset,
      vocalWiredPreset,
      vocalNoMicPreset,
    ] as Preset[]);
    const micField = fields.find((field) => field.kind === "dropdown");
    if (!micField || micField.kind !== "dropdown")
      throw new Error("missing lead voc field");

    const defaultPreset: MusicianSetupPreset = {
      inputs: [
        {
          key: "voc_input",
          label: "Vocal",
          note: "Own wireless mic – boom mic stand",
          group: "vocs",
        },
      ],
      monitoring: { monitorRef: "wedge" },
    };
    const patch = micField.setValue(
      { defaultPreset, effectivePreset: defaultPreset },
      "vocal_wired",
    );
    expect(patch?.inputs?.update?.[0]?.key).toBe("voc_input");

    const effective = applyPresetOverride(defaultPreset, patch);
    expect(
      micField.getValue({ defaultPreset, effectivePreset: effective, patch }),
    ).toBe("vocal_wired");
  });

  it("never allows zero manuals for keys row", () => {
    const fields = buildKeysFields([
      keysStereoXlrPreset,
      keysMonoXlrPreset,
      keysStereoJackPreset,
      keysMonoJackPreset,
    ] as Preset[]);
    const toggleGrid = fields.find((field) => field.kind === "toggleGrid");
    if (!toggleGrid || toggleGrid.kind !== "toggleGrid")
      throw new Error("missing keys toggle grid");
    const keysField = toggleGrid.fields[0];

    const defaultPreset: MusicianSetupPreset = {
      inputs: [
        {
          key: "keys_l",
          label: "Keys L",
          note: "XLR out from rack",
          group: "keys",
        },
        {
          key: "keys_r",
          label: "Keys R",
          note: "XLR out from rack",
          group: "keys",
        },
      ],
      monitoring: { monitorRef: "wedge" },
    };
    const patch = keysField.setValue(
      { defaultPreset, effectivePreset: defaultPreset },
      false,
    );
    const effective = applyPresetOverride(defaultPreset, patch);
    const keyInputs = effective.inputs.filter((item) =>
      item.key.startsWith("keys"),
    );

    expect(
      keysField.getValue({ defaultPreset, effectivePreset: effective, patch }),
    ).toBe(true);
    expect(keyInputs.length).toBeGreaterThan(0);
  });
});
