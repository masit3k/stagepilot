import { applyPresetOverride, createDefaultMusicianPreset } from "../../../../../../../src/domain/rules/presetOverride";
import type { InputChannel, MusicianSetupPreset, PresetOverridePatch } from "../../../../../../../src/domain/model/types";

export type EventSetupEditState = {
  defaultPreset: MusicianSetupPreset;
  effectivePreset: MusicianSetupPreset;
  patch?: PresetOverridePatch;
};

function normalizeAdditionalWedgeCount(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? value : undefined;
}

function normalizeMonitoring(patch?: PresetOverridePatch): PresetOverridePatch["monitoring"] | undefined {
  if (!patch?.monitoring) return undefined;
  const monitoring = {
    ...patch.monitoring,
    additionalWedgeCount: normalizeAdditionalWedgeCount(patch.monitoring.additionalWedgeCount),
  };
  return Object.keys(monitoring).some((key) => monitoring[key as keyof typeof monitoring] !== undefined)
    ? monitoring
    : undefined;
}

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
  const monitoring = normalizeMonitoring(patch);
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


function normalizeInput(input: InputChannel): InputChannel {
  return {
    key: input.key,
    label: input.label,
    ...(input.note ? { note: input.note } : {}),
    ...(input.group ? { group: input.group } : {}),
  };
}

export function normalizeSetup(setup: MusicianSetupPreset): MusicianSetupPreset {
  const additionalWedgeCount = normalizeAdditionalWedgeCount(setup.monitoring?.additionalWedgeCount);
  return {
    inputs: [...setup.inputs]
      .map(normalizeInput)
      .sort((a, b) => a.key.localeCompare(b.key)),
    monitoring: {
      monitorRef: setup.monitoring.monitorRef,
      ...(additionalWedgeCount !== undefined ? { additionalWedgeCount } : {}),
    },
  };
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function areSetupsEqual(left: MusicianSetupPreset, right: MusicianSetupPreset): boolean {
  return deepEqual(normalizeSetup(left), normalizeSetup(right));
}

export function shouldEnableSetupReset(args: {
  eventOverride?: PresetOverridePatch;
  defaultPreset: MusicianSetupPreset;
  effectivePreset: MusicianSetupPreset;
}): boolean {
  if (cleanupPatch(args.eventOverride)) return true;
  return !areSetupsEqual(args.defaultPreset, args.effectivePreset);
}

export function resetOverrides(): undefined {
  return undefined;
}

export function withInputsTarget(defaultInputs: InputChannel[], currentPatch: PresetOverridePatch | undefined, targetInputs: InputChannel[]): PresetOverridePatch | undefined {
  const defaultByKey = new Map(defaultInputs.map((item) => [item.key, item]));
  const targetByKey = new Map(targetInputs.map((item) => [item.key, item]));
  const remove = defaultInputs.filter((item) => !targetByKey.has(item.key)).map((item) => item.key);
  const add = targetInputs.filter((item) => !defaultByKey.has(item.key));
  const update = targetInputs
    .filter((item) => defaultByKey.has(item.key))
    .filter((item) => {
      const source = defaultByKey.get(item.key);
      if (!source) return false;
      return source.label !== item.label || source.note !== item.note || source.group !== item.group;
    })
    .map((item) => ({ key: item.key, label: item.label, note: item.note, group: item.group }));
  return cleanupPatch({
    ...currentPatch,
    inputs: {
      ...currentPatch?.inputs,
      add,
      remove,
      update,
    },
  });
}
