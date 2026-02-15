import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset, Preset } from "../../../../../../../../src/domain/model/types";
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
    id: "el_bass_mic",
    label: "Electric bass mic",
    group: "bass",
    setupGroup: "electric_bass",
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
] as Preset[]);

const defaultPreset: MusicianSetupPreset = {
  inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", group: "bass" }],
  monitoring: { type: "wedge", mode: "mono", mixCount: 1 },
};

describe("buildBassFields", () => {
  it("builds connection options from preset input notes", () => {
    const fields = buildBassFields(presets);
    const dropdown = fields.find((field) => field.kind === "dropdown");
    if (!dropdown || dropdown.kind !== "dropdown") throw new Error("dropdown field missing");
    const labels = dropdown.options({ defaultPreset, effectivePreset: defaultPreset }).map((item) => item.label);
    expect(labels).toEqual(["XLR out from amp", "Mic on bass amp"]);
  });

  it("tracks default semantics for additional + back vocal fields", () => {
    const fields = buildBassFields(presets);
    const additional = fields.find((field) => field.kind === "additionalPicker");
    const toggle = fields.find((field) => field.kind === "toggle");
    if (!additional || additional.kind !== "additionalPicker" || !toggle || toggle.kind !== "toggle") throw new Error("fields missing");

    const pristineState = { defaultPreset, effectivePreset: defaultPreset };
    expect(additional.isDefault(pristineState)).toBe(true);
    expect(toggle.isDefault(pristineState)).toBe(true);

    const withAdditionalPatch = additional.setValue(pristineState, ["bass_synth"]);
    expect(additional.isDefault({ ...pristineState, patch: withAdditionalPatch })).toBe(false);

    const withBackVocalPatch = toggle.setValue(pristineState, true);
    expect(toggle.isDefault({ ...pristineState, patch: withBackVocalPatch })).toBe(false);
  });
});
