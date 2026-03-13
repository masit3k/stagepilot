import { describe, expect, it } from "vitest";
import { resolveMusicianDefaultInputsFromPresets, resolveMusicianDefaultSetupForRole } from "./setupConstants";

describe("resolveMusicianDefaultInputsFromPresets", () => {
  it("resolves bass default input from musician preset ref", () => {
    const inputs = resolveMusicianDefaultInputsFromPresets(
      "bass",
      [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
      {
        el_bass_xlr_pedalboard: {
          id: "el_bass_xlr_pedalboard",
          type: "preset",
          group: "bass",
          label: "Bass",
          inputs: [{ key: "el_bass_xlr_pedalboard", label: "Bass" }],
        } as never,
      },
    );
    expect(inputs?.map((item) => item.key)).toEqual(["el_bass_xlr_pedalboard"]);
  });
});

describe("resolveMusicianDefaultSetupForRole", () => {
  const catalog = {
    el_guitar_xlr_stereo: {
      type: "preset",
      id: "el_guitar_xlr_stereo",
      label: "XLR stereo",
      group: "guitar",
      inputs: [
        { key: "el_guitar_xlr_stereo_l", label: "Guitar L" },
        { key: "el_guitar_xlr_stereo_r", label: "Guitar R" },
      ],
    },
    el_bass_xlr_pedalboard: {
      type: "preset",
      id: "el_bass_xlr_pedalboard",
      label: "Bass pedalboard",
      group: "bass",
      setupGroup: "electric_bass",
      inputs: [{ key: "el_bass_xlr_pedalboard", label: "Bass" }],
    },
    vocal_lead_wireless: {
      type: "preset",
      id: "vocal_lead_wireless",
      label: "Wireless lead vocal",
      group: "vocs",
      inputs: [{ key: "voc_lead", label: "Lead vocal" }],
    },
    iem_stereo_wireless: {
      type: "monitor",
      id: "iem_stereo_wireless",
      label: "IEM stereo wireless",
    },
  } as const;

  it("resolves guitar defaults from musician presets", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "guitar",
      presetItems: [{ kind: "preset", ref: "el_guitar_xlr_stereo" }],
      presetCatalog: catalog,
      bandDefaults: { inputs: [{ key: "gtr_mic", label: "Guitar mic" }], monitoring: { monitorRef: "wedge" } },
    });

    expect(resolved.inputs.map((item) => item.key)).toEqual([
      "el_guitar_xlr_stereo_l",
      "el_guitar_xlr_stereo_r",
    ]);
  });

  it("resolves bass defaults from musician presets", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "bass",
      presetItems: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
      presetCatalog: catalog,
      bandDefaults: { inputs: [{ key: "el_bass_xlr_amp", label: "Amp" }], monitoring: { monitorRef: "wedge" } },
    });

    expect(resolved.inputs.map((item) => item.key)).toEqual(["el_bass_xlr_pedalboard"]);
  });

  it("resolves vocal defaults from musician presets", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "vocs",
      presetItems: [{ kind: "preset", ref: "vocal_lead_wireless" }],
      presetCatalog: catalog,
      bandDefaults: { inputs: [{ key: "voc_lead", label: "Lead vocal" }], monitoring: { monitorRef: "wedge" } },
    });

    expect(resolved.inputs.map((item) => item.key)).toContain("voc_lead");
  });

  it("prefers explicit monitoring override defaults and falls back when no preset refs exist", () => {
    const resolved = resolveMusicianDefaultSetupForRole({
      role: "guitar",
      musicianDefaults: { monitoring: { monitorRef: "iem_stereo_wireless" } },
      presetCatalog: catalog,
      bandDefaults: { inputs: [{ key: "gtr_mic", label: "Guitar mic" }], monitoring: { monitorRef: "wedge" } },
    });

    expect(resolved.monitoring.monitorRef).toBe("iem_stereo_wireless");
    expect(resolved.inputs.map((item) => item.key)).toEqual(["gtr_mic"]);
  });
});
