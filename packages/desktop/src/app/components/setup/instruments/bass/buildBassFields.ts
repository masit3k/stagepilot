import type { InputChannel, Preset, PresetOverridePatch } from "../../../../../../../../src/domain/model/types";
import { cleanupPatch, getPatchedInputs, withInputsTarget, type EventSetupEditState } from "../../adapters/eventSetupAdapter";
import type { DropdownFieldDef, SchemaNode, ToggleFieldDef } from "../../schema/types";

type BassPreset = Preset & { setupGroup?: "electric_bass" | "bass_synth" | "bass_mic" };

function hasInputKey(inputs: InputChannel[], key: string): boolean {
  return inputs.some((item) => item.key === key);
}

function readPatchedInputs(state: EventSetupEditState): InputChannel[] {
  return getPatchedInputs(state.defaultPreset.inputs, state.patch);
}

function readCurrentPrimaryId(state: EventSetupEditState, primaryPresets: BassPreset[]): string {
  const currentInputKeys = new Set(readPatchedInputs(state).map((item) => item.key));
  return primaryPresets.find((preset) => preset.inputs.some((item) => currentInputKeys.has(item.key)))?.id ?? "";
}

function resolveDefaultPrimaryInput(state: EventSetupEditState, primaryPresets: BassPreset[]): InputChannel | undefined {
  for (const preset of primaryPresets) {
    const match = preset.inputs.find((candidate) => state.defaultPreset.inputs.some((item) => item.key === candidate.key));
    if (match) return match;
  }
  return state.defaultPreset.inputs.find((item) => item.key.startsWith("el_bass_"));
}

function mergeConnectionReplacePatch(
  state: EventSetupEditState,
  defaultPrimary: InputChannel | undefined,
  selected: InputChannel,
  primaryPresets: BassPreset[],
): PresetOverridePatch | undefined {
  if (!defaultPrimary) return state.patch;
  const primaryKeys = new Set(primaryPresets.flatMap((preset) => preset.inputs.map((item) => item.key)));
  const add = (state.patch?.inputs?.add ?? []).filter((item) => !primaryKeys.has(item.key));
  const replace = selected.key === defaultPrimary.key
    ? (state.patch?.inputs?.replace ?? []).filter((entry) => entry.targetKey !== defaultPrimary.key)
    : [
      ...(state.patch?.inputs?.replace ?? []).filter((entry) => entry.targetKey !== defaultPrimary.key),
      { targetKey: defaultPrimary.key, with: selected },
    ];

  return cleanupPatch({
    ...state.patch,
    inputs: {
      ...state.patch?.inputs,
      add,
      replace,
    },
  });
}

export function buildBassFields(presets: BassPreset[]): SchemaNode[] {
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
      if (!selectedPreset || !selectedPreset.inputs[0]) return state.patch;
      return mergeConnectionReplacePatch(state, resolveDefaultPrimaryInput(state, primaryPresets), selectedPreset.inputs[0], primaryPresets);
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
    getValue: (state) => (micInput ? hasInputKey(readPatchedInputs(state), micInput.key) : false),
    setValue: (state, value) => {
      if (!micInput) return state.patch;
      const current = readPatchedInputs(state).filter((item) => item.key !== micInput.key);
      return withInputsTarget(state.defaultPreset.inputs, state.patch, value ? [...current, micInput] : current);
    },
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

  return [connectionField, { kind: "toggleGrid", id: "bass-input-toggles", fields: [micField, bassSynthField] }];
}

export function toBassPresets(presets: Preset[]): BassPreset[] {
  return presets.filter((preset): preset is BassPreset => preset.type === "preset" && preset.group === "bass");
}
