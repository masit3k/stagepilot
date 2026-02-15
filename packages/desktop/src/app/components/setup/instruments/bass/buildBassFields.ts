import type { InputChannel, Preset } from "../../../../../../../../src/domain/model/types";
import { getPatchedInputs, withInputsTarget, type EventSetupEditState } from "../../adapters/eventSetupAdapter";
import type { AdditionalPickerFieldDef, DropdownFieldDef, FieldDef, ToggleFieldDef } from "../../schema/types";

type BassPreset = Preset & { setupGroup?: "electric_bass" | "bass_synth" };

const BACK_VOCAL_INPUT: InputChannel = { key: "voc_back", label: "Back vocal", group: "vocs" };

function readCurrentPrimaryId(state: EventSetupEditState, primaryPresets: BassPreset[]): string {
  const currentInputKeys = new Set(getPatchedInputs(state.defaultPreset.inputs, state.patch).map((item) => item.key));
  return primaryPresets.find((preset) => preset.inputs.some((item) => currentInputKeys.has(item.key)))?.id ?? primaryPresets[0]?.id ?? "";
}

export function buildBassFields(presets: BassPreset[]): FieldDef[] {
  const primaryPresets = presets.filter((preset) => preset.setupGroup === "electric_bass");
  const additionalPresets = presets.filter((preset) => preset.setupGroup === "bass_synth");

  const connectionField: DropdownFieldDef = {
    kind: "dropdown",
    id: "bass-connection",
    label: "Connection",
    options: () =>
      primaryPresets.map((preset) => ({
        value: preset.id,
        label: preset.inputs[0]?.note ?? preset.label,
      })),
    getValue: (state) => readCurrentPrimaryId(state, primaryPresets),
    setValue: (state, value) => {
      const selectedPreset = primaryPresets.find((preset) => preset.id === value);
      if (!selectedPreset) return state.patch;
      const currentInputs = getPatchedInputs(state.defaultPreset.inputs, state.patch);
      const withoutPrimary = currentInputs.filter((input) => !primaryPresets.some((preset) => preset.inputs.some((candidate) => candidate.key === input.key)));
      return withInputsTarget(state.defaultPreset.inputs, state.patch, [...withoutPrimary, ...selectedPreset.inputs]);
    },
    isDefault: (state) => {
      const selected = readCurrentPrimaryId(state, primaryPresets);
      const defaultSelected = primaryPresets.find((preset) => preset.inputs.some((input) => state.defaultPreset.inputs.some((def) => def.key === input.key)))?.id ?? primaryPresets[0]?.id ?? "";
      return selected === defaultSelected;
    },
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  const additionalField: AdditionalPickerFieldDef = {
    kind: "additionalPicker",
    id: "bass-additional",
    label: "Additional inputs",
    maxSelected: 1,
    options: () =>
      additionalPresets.map((preset) => ({
        id: preset.id,
        label: preset.inputs[0]?.note ?? preset.label,
        input: preset.inputs[0],
      })),
    getValue: (state) => {
      const keys = new Set(getPatchedInputs(state.defaultPreset.inputs, state.patch).map((input) => input.key));
      return additionalPresets.filter((preset) => preset.inputs.some((input) => keys.has(input.key))).map((preset) => preset.id);
    },
    setValue: (state, value) => {
      const chosen = new Set(value);
      const currentInputs = getPatchedInputs(state.defaultPreset.inputs, state.patch).filter(
        (input) => !additionalPresets.some((preset) => preset.inputs.some((candidate) => candidate.key === input.key)),
      );
      const selectedInputs = additionalPresets.filter((preset) => chosen.has(preset.id)).flatMap((preset) => preset.inputs);
      return withInputsTarget(state.defaultPreset.inputs, state.patch, [...currentInputs, ...selectedInputs]);
    },
    isDefault: (state) => {
      const defaults = new Set(
        additionalPresets.filter((preset) => preset.inputs.some((input) => state.defaultPreset.inputs.some((def) => def.key === input.key))).map((preset) => preset.id),
      );
      const current = new Set(additionalField.getValue(state));
      return defaults.size === current.size && Array.from(defaults).every((id) => current.has(id));
    },
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  const backVocalField: ToggleFieldDef = {
    kind: "toggle",
    id: "bass-back-vocal",
    label: "Back vocal",
    getValue: (state) => getPatchedInputs(state.defaultPreset.inputs, state.patch).some((item) => item.key === BACK_VOCAL_INPUT.key),
    setValue: (state, value) => {
      const current = getPatchedInputs(state.defaultPreset.inputs, state.patch).filter((item) => item.key !== BACK_VOCAL_INPUT.key);
      return withInputsTarget(state.defaultPreset.inputs, state.patch, value ? [...current, BACK_VOCAL_INPUT] : current);
    },
    isDefault: (state) => {
      const defaultHas = state.defaultPreset.inputs.some((item) => item.key === BACK_VOCAL_INPUT.key);
      return backVocalField.getValue(state) === defaultHas;
    },
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  return [connectionField, additionalField, backVocalField];
}

export function toBassPresets(presets: Preset[]): BassPreset[] {
  return presets.filter((preset): preset is BassPreset => preset.type === "preset" && preset.group === "bass");
}
