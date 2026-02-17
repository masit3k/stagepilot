import type { PresetOverridePatch } from "../model/types.js";

export function normalizePresetOverridePatch(patch?: PresetOverridePatch): PresetOverridePatch | undefined {
  if (!patch) return undefined;
  const remove = patch.inputs?.remove ?? patch.inputs?.removeKeys;
  return {
    ...patch,
    ...(patch.inputs
      ? {
        inputs: {
          ...patch.inputs,
          ...(remove?.length ? { remove } : {}),
        },
      }
      : {}),
  };
}
