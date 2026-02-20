import type { MusicianSetupPreset, PresetOverridePatch } from "../model/types.js";
import { applyPresetOverride, normalizeSetupOverridePatch } from "../rules/presetOverride.js";

type ComparablePreset = {
  monitoring: { monitorRef: string; additionalWedgeCount?: number };
  inputs: Array<{ key: string; label: string; note?: string; group: string }>;
};

function normalizePreset(preset: MusicianSetupPreset): ComparablePreset {
  return {
    monitoring: {
      monitorRef: preset.monitoring.monitorRef,
      ...(preset.monitoring.additionalWedgeCount && preset.monitoring.additionalWedgeCount > 0
        ? { additionalWedgeCount: preset.monitoring.additionalWedgeCount }
        : {}),
    },
    inputs: [...preset.inputs]
      .map((item) => ({ key: item.key, label: item.label, note: item.note, group: item.group }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export function isPatchDifferentFromDefault(
  defaultPreset: MusicianSetupPreset,
  patch?: PresetOverridePatch,
): boolean {
  const normalizedPatch = normalizeSetupOverridePatch(defaultPreset, patch);
  if (!normalizedPatch) return false;
  const effective = applyPresetOverride(defaultPreset, normalizedPatch);
  return JSON.stringify(normalizePreset(defaultPreset)) !== JSON.stringify(normalizePreset(effective));
}
