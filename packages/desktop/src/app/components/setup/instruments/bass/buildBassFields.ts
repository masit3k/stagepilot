import type { InputChannel, Preset } from "../../../../../../../../src/domain/model/types";
import { getPatchedInputs, withInputsTarget, type EventSetupEditState } from "../../adapters/eventSetupAdapter";
import type { DropdownFieldDef, FieldDef, ToggleFieldDef } from "../../schema/types";

type BassPreset = Preset & { setupGroup?: "electric_bass" | "bass_synth" | "bass_mic" };

const FALLBACK_BACK_VOCAL_INPUT: InputChannel = { key: "voc_back_bass", label: "Back vocal – bass", group: "vocs" };

function hasInputKey(inputs: InputChannel[], key: string): boolean {
  return inputs.some((item) => item.key === key);
}

function readPatchedInputs(state: EventSetupEditState): InputChannel[] {
  return getPatchedInputs(state.defaultPreset.inputs, state.patch);
}

function findBackVocalInput(state: EventSetupEditState): InputChannel {
  const source = [...readPatchedInputs(state), ...state.defaultPreset.inputs, ...state.effectivePreset.inputs];
  return source.find((item) => item.key.startsWith("voc_back")) ?? FALLBACK_BACK_VOCAL_INPUT;
}

function readCurrentPrimaryId(state: EventSetupEditState, primaryPresets: BassPreset[]): string {
  const currentInputKeys = new Set(readPatchedInputs(state).map((item) => item.key));
  return primaryPresets.find((preset) => preset.inputs.some((item) => currentInputKeys.has(item.key)))?.id ?? "";
}

function hasConnection(state: EventSetupEditState, primaryPresets: BassPreset[]): boolean {
  return primaryPresets.some((preset) => preset.id === readCurrentPrimaryId(state, primaryPresets));
}

export function buildBassFields(presets: BassPreset[]): FieldDef[] {
  const primaryPresets = presets.filter((preset) => preset.setupGroup === "electric_bass");
  const micPreset = presets.find((preset) => preset.setupGroup === "bass_mic");
  const bassSynthPreset = presets.find((preset) => preset.setupGroup === "bass_synth");
  const micInput = micPreset?.inputs[0];
  const bassSynthInput = bassSynthPreset?.inputs[0];

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
      const currentInputs = readPatchedInputs(state);
      const withoutPrimary = currentInputs.filter((input) => !primaryPresets.some((preset) => preset.inputs.some((candidate) => candidate.key === input.key)));
      return withInputsTarget(state.defaultPreset.inputs, state.patch, [...withoutPrimary, ...selectedPreset.inputs]);
    },
    isDefault: (state) => {
      const selected = readCurrentPrimaryId(state, primaryPresets);
      const defaultSelected = primaryPresets.find((preset) => preset.inputs.some((input) => state.defaultPreset.inputs.some((def) => def.key === input.key)))?.id ?? "";
      return selected === defaultSelected;
    },
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  const micField: ToggleFieldDef = {
    kind: "toggle",
    id: "bass-mic-on-cabinet",
    label: "Mic on cabinet",
    getValue: (state) => {
      if (!micInput || !hasConnection(state, primaryPresets)) return false;
      return hasInputKey(readPatchedInputs(state), micInput.key);
    },
    setValue: (state, value) => {
      if (!micInput || (!hasConnection(state, primaryPresets) && value)) return withInputsTarget(state.defaultPreset.inputs, state.patch, readPatchedInputs(state).filter((item) => item.key !== micInput?.key));
      const current = readPatchedInputs(state).filter((item) => item.key !== micInput.key);
      return withInputsTarget(state.defaultPreset.inputs, state.patch, value ? [...current, micInput] : current);
    },
    isDisabled: (state) => !hasConnection(state, primaryPresets),
    isDefault: (state) => {
      if (!micInput) return true;
      const defaultHas = hasInputKey(state.defaultPreset.inputs, micInput.key);
      return micField.getValue(state) === defaultHas;
    },
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  const bassSynthField: ToggleFieldDef = {
    kind: "toggle",
    id: "bass-synth",
    label: "Bass synth",
    getValue: (state) => (bassSynthInput ? hasInputKey(readPatchedInputs(state), bassSynthInput.key) : false),
    setValue: (state, value) => {
      if (!bassSynthInput) return state.patch;
      const current = readPatchedInputs(state).filter((item) => item.key !== bassSynthInput.key);
      return withInputsTarget(state.defaultPreset.inputs, state.patch, value ? [...current, bassSynthInput] : current);
    },
    isDefault: (state) => {
      if (!bassSynthInput) return true;
      const defaultHas = hasInputKey(state.defaultPreset.inputs, bassSynthInput.key);
      return bassSynthField.getValue(state) === defaultHas;
    },
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  const backVocalField: ToggleFieldDef = {
    kind: "toggle",
    id: "bass-back-vocal",
    label: "Back vocal",
    getValue: (state) => readPatchedInputs(state).some((item) => item.key.startsWith("voc_back")),
    setValue: (state, value) => {
      const current = readPatchedInputs(state).filter((item) => !item.key.startsWith("voc_back"));
      return withInputsTarget(state.defaultPreset.inputs, state.patch, value ? [...current, findBackVocalInput(state)] : current);
    },
    isDefault: (state) => {
      const defaultHas = state.defaultPreset.inputs.some((item) => item.key.startsWith("voc_back"));
      return backVocalField.getValue(state) === defaultHas;
    },
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  return [connectionField, micField, bassSynthField, backVocalField];
}

export function toBassPresets(presets: Preset[]): BassPreset[] {
  return presets.filter((preset): preset is BassPreset => preset.type === "preset" && preset.group === "bass");
}
