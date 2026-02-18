import { describe, expect, it } from "vitest";
import type { Preset } from "../../../../../../../../src/domain/model/types";
import { buildKeysFields } from "./buildKeysFields";

const presets: Preset[] = [
  { type: "preset", id: "keys", label: "Keys", group: "keys", inputs: [{ key: "keys_l", label: "L" }, { key: "keys_r", label: "R" }] },
  { type: "preset", id: "synth", label: "Synth", group: "keys", inputs: [{ key: "synth_l", label: "L" }, { key: "synth_r", label: "R" }] },
  { type: "preset", id: "synth_mono", label: "Synth mono", group: "keys", inputs: [{ key: "synth_mono", label: "Mono" }] },
];
const state = { defaultPreset: { inputs: [], monitoring: { monitorRef: "wedge" } }, effectivePreset: { inputs: [], monitoring: { monitorRef: "wedge" } } };

describe("buildKeysFields", () => {
  it("enables row with count when toggled", () => {
    const grid = buildKeysFields(presets)[0];
    if (grid.kind !== "toggleGrid") throw new Error("missing");
    const keysField = grid.fields[0];
    const patch = keysField.setValue(state, true);
    expect(patch?.inputs?.add?.map((item) => item.key)).toEqual(["keys_1_l", "keys_1_r"]);
  });

  it("updates count through stepper semantics", () => {
    const grid = buildKeysFields(presets)[0];
    if (grid.kind !== "toggleGrid") throw new Error("missing");
    const synthField = grid.fields[1];
    const enabledPatch = synthField.setValue(state, true);
    const next = synthField.setCount({ ...state, patch: enabledPatch, effectivePreset: { ...state.effectivePreset, inputs: enabledPatch?.inputs?.add ?? [] } }, 3);
    expect(next?.inputs?.add?.map((item) => item.key)).toEqual(["synth_1_l", "synth_1_r", "synth_2_l", "synth_2_r", "synth_3_l", "synth_3_r"]);
  });

  it("toggle off removes override", () => {
    const grid = buildKeysFields(presets)[0];
    if (grid.kind !== "toggleGrid") throw new Error("missing");
    const monoField = grid.fields[2];
    const enabledPatch = monoField.setValue(state, true);
    const disabledPatch = monoField.setValue({ ...state, patch: enabledPatch, effectivePreset: { ...state.effectivePreset, inputs: enabledPatch?.inputs?.add ?? [] } }, false);
    expect(disabledPatch).toBeUndefined();
  });
});
