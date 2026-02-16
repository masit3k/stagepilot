import { applyPresetOverride, createDefaultMusicianPreset } from "../../../../../../../src/domain/rules/presetOverride";
import type { InputChannel, MusicianSetupPreset, PresetOverridePatch } from "../../../../../../../src/domain/model/types";

export type EventSetupEditState = {
  defaultPreset: MusicianSetupPreset;
  effectivePreset: MusicianSetupPreset;
  patch?: PresetOverridePatch;
};

export function getPatchedInputs(defaultInputs: InputChannel[], patch?: PresetOverridePatch): InputChannel[] {
  const defaultPreset: MusicianSetupPreset = {
    ...createDefaultMusicianPreset(),
    inputs: defaultInputs,
  };
  return applyPresetOverride(defaultPreset, patch).inputs;
}

export function mergePatch(current: PresetOverridePatch | undefined, partial: PresetOverridePatch): PresetOverridePatch | undefined {
  const merged: PresetOverridePatch = {
    ...current,
    ...partial,
    inputs: {
      ...current?.inputs,
      ...partial.inputs,
      ...(partial.inputs?.add ? { add: partial.inputs.add } : {}),
      ...(partial.inputs?.remove ? { remove: partial.inputs.remove } : {}),
      ...(partial.inputs?.removeKeys ? { removeKeys: partial.inputs.removeKeys } : {}),
      ...(partial.inputs?.replace ? { replace: partial.inputs.replace } : {}),
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
  const remove = patch.inputs?.remove?.length ? patch.inputs.remove : undefined;
  const replace = patch.inputs?.replace?.length ? patch.inputs.replace : undefined;
  const update = patch.inputs?.update?.length ? patch.inputs.update : undefined;
  const monitoring = patch.monitoring && Object.keys(patch.monitoring).length > 0 ? patch.monitoring : undefined;
  const inputs = add || remove || replace || update
    ? {
      ...(add ? { add } : {}),
      ...(remove ? { remove } : {}),
      ...(replace ? { replace } : {}),
      ...(update ? { update } : {}),
    }
    : undefined;
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
  const remove = defaultInputs.filter((item) => !targetByKey.has(item.key)).map((item) => item.key);
  const add = targetInputs.filter((item) => !defaultByKey.has(item.key));
  return cleanupPatch({
    ...currentPatch,
    inputs: {
      ...currentPatch?.inputs,
      add,
      remove,
    },
  });
}
