import type { InputChannel, MusicianSetupPreset, PresetOverridePatch } from "../../../../../../../src/domain/model/types";

export type EventSetupEditState = {
  defaultPreset: MusicianSetupPreset;
  effectivePreset: MusicianSetupPreset;
  patch?: PresetOverridePatch;
};

function uniqueByKey(inputs: InputChannel[]): InputChannel[] {
  const byKey = new Map<string, InputChannel>();
  for (const item of inputs) byKey.set(item.key, item);
  return Array.from(byKey.values());
}

export function getPatchedInputs(defaultInputs: InputChannel[], patch?: PresetOverridePatch): InputChannel[] {
  if (!patch?.inputs) return defaultInputs;
  const removed = new Set(patch.inputs.removeKeys ?? []);
  const base = defaultInputs.filter((item) => !removed.has(item.key));
  return uniqueByKey([...base, ...(patch.inputs.add ?? [])]);
}

export function mergePatch(current: PresetOverridePatch | undefined, partial: PresetOverridePatch): PresetOverridePatch | undefined {
  const merged: PresetOverridePatch = {
    ...current,
    ...partial,
    inputs: {
      ...current?.inputs,
      ...partial.inputs,
      ...(partial.inputs?.add ? { add: partial.inputs.add } : {}),
      ...(partial.inputs?.removeKeys ? { removeKeys: partial.inputs.removeKeys } : {}),
    },
    monitoring: {
      ...current?.monitoring,
      ...partial.monitoring,
    },
  };
  return cleanupPatch(merged);
}

export function cleanupPatch(patch?: PresetOverridePatch): PresetOverridePatch | undefined {
  if (!patch) return undefined;
  const add = patch.inputs?.add?.length ? patch.inputs.add : undefined;
  const removeKeys = patch.inputs?.removeKeys?.length ? patch.inputs.removeKeys : undefined;
  const update = patch.inputs?.update?.length ? patch.inputs.update : undefined;
  const monitoring = patch.monitoring && Object.keys(patch.monitoring).length > 0 ? patch.monitoring : undefined;
  const inputs = add || removeKeys || update ? { ...(add ? { add } : {}), ...(removeKeys ? { removeKeys } : {}), ...(update ? { update } : {}) } : undefined;
  if (!inputs && !monitoring) return undefined;
  return { ...(inputs ? { inputs } : {}), ...(monitoring ? { monitoring } : {}) };
}

export function computeIsDirty(patch?: PresetOverridePatch): boolean {
  return Boolean(cleanupPatch(patch));
}

export function resetOverrides(): undefined {
  return undefined;
}

export function withInputsTarget(defaultInputs: InputChannel[], currentPatch: PresetOverridePatch | undefined, targetInputs: InputChannel[]): PresetOverridePatch | undefined {
  const defaultByKey = new Set(defaultInputs.map((item) => item.key));
  const targetByKey = new Set(targetInputs.map((item) => item.key));
  const removeKeys = defaultInputs.filter((item) => !targetByKey.has(item.key)).map((item) => item.key);
  const add = targetInputs.filter((item) => !defaultByKey.has(item.key));
  return cleanupPatch({
    ...currentPatch,
    inputs: {
      ...currentPatch?.inputs,
      ...(add.length > 0 ? { add } : {}),
      ...(removeKeys.length > 0 ? { removeKeys } : {}),
    },
  });
}
