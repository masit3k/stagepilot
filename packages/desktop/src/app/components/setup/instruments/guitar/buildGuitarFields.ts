import type { InputChannel, Preset } from "../../../../../../../../src/domain/model/types";
import { withInputsTarget, type EventSetupEditState } from "../../adapters/eventSetupAdapter";
import type { DropdownFieldDef, SchemaNode, ToggleFieldDef } from "../../schema/types";

type GuitarPreset = Preset & { id: "el_guitar_mic" | "el_guitar_xlr_mono" | "el_guitar_xlr_stereo" | "ac_guitar" };

function hasInput(inputs: InputChannel[], keyPrefix: string): boolean {
  return inputs.some((item) => item.key === keyPrefix || item.key.startsWith(`${keyPrefix}_`));
}

function readMainPresetId(inputs: InputChannel[]): GuitarPreset["id"] {
  if (hasInput(inputs, "el_guitar_xlr_l") || hasInput(inputs, "el_guitar_xlr_r")) return "el_guitar_xlr_stereo";
  if (hasInput(inputs, "el_guitar_xlr")) return "el_guitar_xlr_mono";
  return "el_guitar_mic";
}

function currentMainPresetId(state: EventSetupEditState, _presets: Record<string, GuitarPreset | undefined>): GuitarPreset["id"] {
  return readMainPresetId(state.effectivePreset.inputs);
}

function defaultMainPresetId(state: EventSetupEditState, _presets: Record<string, GuitarPreset | undefined>): GuitarPreset["id"] {
  return readMainPresetId(state.defaultPreset.inputs);
}

function rebuild(state: EventSetupEditState, presets: Record<string, GuitarPreset | undefined>, mainId: string, micOnCab: boolean, acoustic: boolean) {
  const keep = state.effectivePreset.inputs.filter((item) => !["el_guitar", "ac_guitar"].some((prefix) => item.key.startsWith(prefix)));
  const mainInputs = presets[mainId]?.inputs ?? [];
  const micInput = presets.el_guitar_mic?.inputs[0];
  const acInput = presets.ac_guitar?.inputs[0];
  const next = [...keep, ...mainInputs];
  if (micOnCab && micInput && !next.some((item) => item.key === micInput.key)) next.push(micInput);
  if (acoustic && acInput && !next.some((item) => item.key === acInput.key)) next.push(acInput);
  return next;
}

export function buildGuitarFields(presets: Preset[]): SchemaNode[] {
  const byId = Object.fromEntries(
    presets
      .filter((preset): preset is GuitarPreset => preset.type === "preset" && preset.group === "guitar")
      .map((preset) => [preset.id, preset]),
  ) as Record<string, GuitarPreset | undefined>;

  const connectionField: DropdownFieldDef = {
    kind: "dropdown",
    id: "guitar-connection",
    label: "Connection",
    hideVisibleLabel: true,
    ariaLabel: "Connection",
    options: () => [
      { value: "el_guitar_mic", label: "Electric guitar (mic)" },
      { value: "el_guitar_xlr_mono", label: "Electric guitar (XLR mono)" },
      { value: "el_guitar_xlr_stereo", label: "Electric guitar (XLR stereo)" },
    ],
    getValue: (state) => currentMainPresetId(state, byId),
    setValue: (state, value) => {
      const micOnCab = hasInput(state.effectivePreset.inputs, "el_guitar_mic") && value !== "el_guitar_mic";
      const acoustic = hasInput(state.effectivePreset.inputs, "ac_guitar");
      return withInputsTarget(state.defaultPreset.inputs, state.patch, rebuild(state, byId, value, micOnCab, acoustic));
    },
    isDefault: (state) => currentMainPresetId(state, byId) === defaultMainPresetId(state, byId),
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  const micField: ToggleFieldDef = {
    kind: "toggle",
    id: "guitar-mic-on-cab",
    label: "Mic on cabinet",
    getValue: (state) => hasInput(state.effectivePreset.inputs, "el_guitar_mic"),
    setValue: (state, value) => {
      const main = currentMainPresetId(state, byId);
      const acoustic = hasInput(state.effectivePreset.inputs, "ac_guitar");
      return withInputsTarget(state.defaultPreset.inputs, state.patch, rebuild(state, byId, main, value, acoustic));
    },
    isDefault: (state) => hasInput(state.effectivePreset.inputs, "el_guitar_mic") === hasInput(state.defaultPreset.inputs, "el_guitar_mic"),
    isVisible: (state) => currentMainPresetId(state, byId) !== "el_guitar_mic",
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  const acousticField: ToggleFieldDef = {
    kind: "toggle",
    id: "guitar-acoustic",
    label: "Acoustic guitar",
    getValue: (state) => hasInput(state.effectivePreset.inputs, "ac_guitar"),
    setValue: (state, value) => {
      const main = currentMainPresetId(state, byId);
      const micOnCab = hasInput(state.effectivePreset.inputs, "el_guitar_mic") && main !== "el_guitar_mic";
      return withInputsTarget(state.defaultPreset.inputs, state.patch, rebuild(state, byId, main, micOnCab, value));
    },
    isDefault: (state) => hasInput(state.effectivePreset.inputs, "ac_guitar") === hasInput(state.defaultPreset.inputs, "ac_guitar"),
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  return [connectionField, { kind: "toggleGrid", id: "guitar-input-toggles", fields: [micField, acousticField] }];
}
