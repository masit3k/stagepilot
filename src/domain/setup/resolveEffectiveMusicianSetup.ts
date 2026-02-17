import { applyPresetOverride, createDefaultMusicianPreset } from "../rules/presetOverride.js";
import type { Group } from "../model/groups.js";
import type { MusicianSetupPreset, PresetOverridePatch } from "../model/types.js";
import { computeSetupDiff, type SetupDiffMeta } from "./computeSetupDiff.js";
import { orderInputs } from "./orderInputs.js";
import { normalizePresetOverridePatch } from "./normalizeMonitoring.js";

export type ResolveEffectiveMusicianSetupInput = {
  musicianDefaults?: Partial<MusicianSetupPreset>;
  bandDefaults?: Partial<MusicianSetupPreset>;
  eventOverride?: PresetOverridePatch;
  group?: Group;
};

export type ResolveEffectiveMusicianSetupOutput = {
  effectiveInputs: MusicianSetupPreset["inputs"];
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  diffMeta: SetupDiffMeta;
  defaultPreset: MusicianSetupPreset;
};

function mergeDefaults(
  musicianDefaults?: Partial<MusicianSetupPreset>,
  bandDefaults?: Partial<MusicianSetupPreset>,
): MusicianSetupPreset {
  const fallback = createDefaultMusicianPreset();
  const baseInputs = musicianDefaults?.inputs ?? bandDefaults?.inputs ?? fallback.inputs;

  return {
    inputs: baseInputs.map((item) => ({ ...item })),
    monitoring: musicianDefaults?.monitoring ?? bandDefaults?.monitoring ?? fallback.monitoring,
  };
}

export function resolveEffectiveMusicianSetup(
  input: ResolveEffectiveMusicianSetupInput,
): ResolveEffectiveMusicianSetupOutput {
  const defaultPreset = mergeDefaults(input.musicianDefaults, input.bandDefaults);
  const effectivePreset = applyPresetOverride(defaultPreset, normalizePresetOverridePatch(input.eventOverride));
  const effectiveInputs = orderInputs(effectivePreset.inputs, input.group);
  const sortedDefault = orderInputs(defaultPreset.inputs, input.group);
  const diffMeta = computeSetupDiff({
    defaultPreset: { ...defaultPreset, inputs: sortedDefault },
    effectivePreset: { ...effectivePreset, inputs: effectiveInputs },
    eventOverride: normalizePresetOverridePatch(input.eventOverride),
  });

  return {
    effectiveInputs,
    effectiveMonitoring: effectivePreset.monitoring,
    diffMeta,
    defaultPreset: {
      ...defaultPreset,
      inputs: sortedDefault,
    },
  };
}
