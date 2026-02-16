import type { MusicianSetupPreset, Preset } from "../../../../../../../../src/domain/model/types";
import { describe, expect, it } from "vitest";
import { buildBassFields, toBassPresets } from "./buildBassFields";

const presets = toBassPresets([
  {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Electric bass guitar",
    group: "bass",
    setupGroup: "electric_bass",
    inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" }],
  },
  {
    type: "preset",
    id: "el_bass_xlr_pedalboard",
    label: "Electric bass guitar",
    group: "bass",
    setupGroup: "electric_bass",
    inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", note: "XLR out from pedalboard", group: "bass" }],
  },
  {
    type: "preset",
    id: "el_bass_mic",
    label: "Electric bass mic",
    group: "bass",
    setupGroup: "bass_mic",
    inputs: [{ key: "el_bass_mic", label: "Electric bass mic", note: "Mic on bass amp", group: "bass" }],
  },
  {
    type: "preset",
    id: "bass_synth",
    label: "Bass synth",
    group: "bass",
    setupGroup: "bass_synth",
    inputs: [{ key: "bass_synth", label: "Bass synth", note: "TS jack 6.3mm – DI box", group: "bass" }],
  },
] as unknown as Preset[]);

const defaultPreset: MusicianSetupPreset = {
  inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", group: "bass" }],
  monitoring: { type: "wedge", mode: "mono", mixCount: 1 },
};

describe("buildBassFields", () => {
  it("keeps only XLR presets in connection options", () => {
    const fields = buildBassFields(presets);
    const dropdown = fields.find((field) => field.kind === "dropdown");
    if (!dropdown || dropdown.kind !== "dropdown") throw new Error("dropdown field missing");
    const labels = dropdown.options({ defaultPreset, effectivePreset: defaultPreset }).map((item) => item.label);
    expect(labels).toEqual(["XLR out from amp", "XLR out from pedalboard"]);
  });

  it("exposes only mic and bass synth as boolean toggles", () => {
    const fields = buildBassFields(presets);
    const toggleGrid = fields.find((field) => field.kind === "toggleGrid");
    if (!toggleGrid || toggleGrid.kind !== "toggleGrid") throw new Error("toggle grid missing");
    expect(toggleGrid.fields.map((field) => field.label)).toEqual(["Mic on cabinet", "Bass synth"]);
  });

  it("disables mic toggle when no connection is selected", () => {
    const fields = buildBassFields(presets);
    const toggleGrid = fields.find((field) => field.kind === "toggleGrid");
    if (!toggleGrid || toggleGrid.kind !== "toggleGrid") throw new Error("toggle grid missing");
    const mic = toggleGrid.fields.find((field) => field.id === "bass-mic-on-cabinet");
    if (!mic) throw new Error("mic field missing");

    const noConnectionState = {
      defaultPreset: { ...defaultPreset, inputs: [] },
      effectivePreset: { ...defaultPreset, inputs: [] },
    };

    expect(mic.isDisabled?.(noConnectionState)).toBe(true);
    expect(mic.getValue(noConnectionState)).toBe(false);
  });

  it("adds and removes bass synth via toggle", () => {
    const fields = buildBassFields(presets);
    const toggleGrid = fields.find((field) => field.kind === "toggleGrid");
    if (!toggleGrid || toggleGrid.kind !== "toggleGrid") throw new Error("toggle grid missing");
    const bassSynth = toggleGrid.fields.find((field) => field.id === "bass-synth");
    if (!bassSynth) throw new Error("bass synth field missing");

    const pristineState = { defaultPreset, effectivePreset: defaultPreset };
    const enabledPatch = bassSynth.setValue(pristineState, true);
    expect(enabledPatch?.inputs?.add?.some((item) => item.key === "bass_synth")).toBe(true);

    const disabledPatch = bassSynth.setValue({ ...pristineState, patch: enabledPatch }, false);
    expect(bassSynth.getValue({ ...pristineState, patch: disabledPatch })).toBe(false);
  });
});
