import type { InputChannel, Preset } from "../../../../../../../../src/domain/model/types";
import { withInputsTarget, type EventSetupEditState } from "../../adapters/eventSetupAdapter";
import type { SchemaNode, ToggleWithStepperFieldDef } from "../../schema/types";
import { buildMonoInstanceInputs, buildStereoInstanceInputs, clampKeysCount, MIN_KEYS_COUNT } from "./keysInstanceInputs";

type KeysPreset = Preset & { id: "keys_jack" | "keys_xlr" | "synth" | "synth_mono" };

type Counts = { keys?: number; synth?: number; synthMono?: number };

function hasPrefix(input: InputChannel, prefix: string): boolean {
  return input.key === prefix || input.key.startsWith(`${prefix}_`);
}

function readCounts(inputs: InputChannel[]): Counts {
  const counts: Counts = {};
  for (const item of inputs) {
    const m = item.key.match(/^(keys|synth|synth_mono)_(\d+)(?:_[lr])?$/);
    if (m) {
      const key = m[1] === "synth_mono" ? "synthMono" : (m[1] as "keys" | "synth");
      const n = Number(m[2]);
      counts[key] = Math.max(counts[key] ?? 0, n);
      continue;
    }
    if (item.key === "keys_l" || item.key === "keys_r") counts.keys = Math.max(counts.keys ?? 0, 1);
    if (item.key === "synth_l" || item.key === "synth_r") counts.synth = Math.max(counts.synth ?? 0, 1);
    if (item.key === "synth_mono") counts.synthMono = Math.max(counts.synthMono ?? 0, 1);
  }
  return counts;
}

function resolveKeysTemplate(
  effectiveInputs: InputChannel[],
  defaultInputs: InputChannel[],
  byId: Record<string, KeysPreset | undefined>,
): KeysPreset | undefined {
  const search = [...effectiveInputs, ...defaultInputs];
  const keysInput = search.find((i) => i.key === "keys_l" || /^keys_\d+_l$/.test(i.key));
  if (keysInput?.note === "XLR out from rack") return byId.keys_xlr ?? byId.keys_jack;
  return byId.keys_jack ?? byId.keys_xlr;
}

function rebuildInputs(state: EventSetupEditState, presets: Record<string, KeysPreset | undefined>, next: Required<Counts>): InputChannel[] {
  const keep = state.effectivePreset.inputs.filter((item) => !["keys", "synth", "synth_mono"].some((prefix) => hasPrefix(item, prefix)));
  const keysPreset = resolveKeysTemplate(state.effectivePreset.inputs, state.defaultPreset.inputs, presets);
  const keysInputs = keysPreset && next.keys > 0 ? buildStereoInstanceInputs(keysPreset.inputs, "keys", next.keys) : [];
  const synthInputs = presets.synth && next.synth > 0 ? buildStereoInstanceInputs(presets.synth.inputs, "synth", next.synth) : [];
  const synthMonoInputs = presets.synth_mono?.inputs[0] && next.synthMono > 0 ? buildMonoInstanceInputs(presets.synth_mono.inputs[0], "synth_mono", next.synthMono) : [];
  return [...keep, ...keysInputs, ...synthInputs, ...synthMonoInputs];
}

function createField(args: {
  id: string;
  label: string;
  countKey: keyof Required<Counts>;
  presets: Record<string, KeysPreset | undefined>;
}): ToggleWithStepperFieldDef {
  return {
    kind: "toggleWithStepper",
    id: args.id,
    label: args.label,
    min: 1,
    max: 3,
    alwaysOn: args.countKey === "keys",
    getValue: (state) => args.countKey === "keys" ? true : (readCounts(state.effectivePreset.inputs)[args.countKey] ?? 0) > 0,
    getCount: (state) => clampKeysCount(readCounts(state.effectivePreset.inputs)[args.countKey] ?? MIN_KEYS_COUNT),
    setCount: (state, value) => {
      const counts = readCounts(state.effectivePreset.inputs);
      const normalized = {
        keys: counts.keys ? clampKeysCount(counts.keys) : 0,
        synth: counts.synth ? clampKeysCount(counts.synth) : 0,
        synthMono: counts.synthMono ? clampKeysCount(counts.synthMono) : 0,
      };
      normalized[args.countKey] = clampKeysCount(value);
      const target = rebuildInputs(state, args.presets, normalized);
      return withInputsTarget(state.defaultPreset.inputs, state.patch, target);
    },
    setValue: (state, value) => {
      const counts = readCounts(state.effectivePreset.inputs);
      const normalized = {
        keys: counts.keys ? clampKeysCount(counts.keys) : 0,
        synth: counts.synth ? clampKeysCount(counts.synth) : 0,
        synthMono: counts.synthMono ? clampKeysCount(counts.synthMono) : 0,
      };
      normalized[args.countKey] = value || args.countKey === "keys" ? Math.max(normalized[args.countKey], 1) : 0;
      const target = rebuildInputs(state, args.presets, {
        keys: normalized.keys || 0,
        synth: normalized.synth || 0,
        synthMono: normalized.synthMono || 0,
      });
      return withInputsTarget(state.defaultPreset.inputs, state.patch, target);
    },
    isDefault: (state) => {
      const current = readCounts(state.effectivePreset.inputs)[args.countKey] ?? 0;
      const defaults = readCounts(state.defaultPreset.inputs)[args.countKey] ?? 0;
      return current === defaults;
    },
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };
}

export function buildKeysFields(presets: Preset[]): SchemaNode[] {
  const byId = Object.fromEntries(
    presets
      .filter((preset): preset is KeysPreset => preset.type === "preset" && preset.group === "keys" && ["keys_jack", "keys_xlr", "synth", "synth_mono"].includes(preset.id))
      .map((preset) => [preset.id, preset]),
  ) as Record<string, KeysPreset | undefined>;

  return [
    {
      kind: "toggleGrid",
      id: "keys-inputs",
      fields: [
        createField({ id: "keys-stereo", label: "Keys", countKey: "keys", presets: byId }),
        createField({ id: "synth-stereo", label: "Synth (stereo)", countKey: "synth", presets: byId }),
        createField({ id: "synth-mono", label: "Synth (mono)", countKey: "synthMono", presets: byId }),
      ],
    },
  ];
}
