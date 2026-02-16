import { GROUP_ORDER } from "../model/groups.js";
import type {
  InputChannel,
  InputReplacePatch,
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../model/types.js";

/**
 * Aux sends available for monitor mixes in the default lineup flow.
 * This value is currently fixed by application rules (no project-level override).
 */
export const DEFAULT_MONITOR_MIX_LIMIT = 6;

export type EffectivePresetValidation = {
  errors: string[];
  warnings: string[];
  totals: {
    inputChannels: number;
    monitorMixes: number;
    monitorMixLimit: number;
  };
};

function getRequiredMonitorMixCount(preset: MusicianSetupPreset): number {
  // Wedge defaults are intentionally treated as zero required aux sends so
  // projects without explicit monitor setup are not unexpectedly blocked.
  if (preset.monitoring.type === "wedge") return 0;
  return Math.max(0, preset.monitoring.mixCount ?? 0);
}

export function applyPresetOverride(
  defaultPreset: MusicianSetupPreset,
  patch?: PresetOverridePatch | null,
): MusicianSetupPreset {
  const base: MusicianSetupPreset = {
    inputs: defaultPreset.inputs.map((input) => ({ ...input })),
    monitoring: { ...defaultPreset.monitoring },
  };
  if (!patch) return base;

  if (patch.monitoring) {
    base.monitoring = {
      ...base.monitoring,
      ...patch.monitoring,
    };
  }

  const remove = new Set([...(patch.inputs?.remove ?? []), ...(patch.inputs?.removeKeys ?? [])]);
  let inputs = base.inputs.filter((input) => !remove.has(input.key));

  for (const update of patch.inputs?.update ?? []) {
    inputs = inputs.map((input) =>
      input.key === update.key
        ? {
          ...input,
          ...(update.label !== undefined ? { label: update.label } : {}),
          ...(update.note !== undefined ? { note: update.note } : {}),
          ...(update.group !== undefined ? { group: update.group } : {}),
        }
        : input,
    );
  }

  const normalizedReplace = normalizeLegacyBassConnectionReplace(inputs, patch.inputs?.replace, patch.inputs?.add ?? []);
  inputs = applyInputReplacements(inputs, normalizedReplace);

  const replacementKeys = new Set(normalizedReplace.map((entry) => entry.with.key));
  for (const add of patch.inputs?.add ?? []) {
    if (replacementKeys.has(add.key)) continue;
    if (inputs.some((existing) => existing.key === add.key)) {
      throw new Error(`Preset override collision for input key "${add.key}".`);
    }
    inputs.push({ ...add });
  }

  return {
    inputs,
    monitoring: base.monitoring,
  };
}

function applyInputReplacements(inputs: InputChannel[], replace: InputReplacePatch[]): InputChannel[] {
  const out = inputs.map((item) => ({ ...item }));
  for (const entry of replace) {
    const targetIndex = out.findIndex((item) => item.key === entry.targetKey);
    const duplicateIndex = out.findIndex((item, index) => item.key === entry.with.key && index !== targetIndex);
    if (duplicateIndex >= 0) out.splice(duplicateIndex, 1);
    if (targetIndex >= 0) {
      out[targetIndex] = { ...entry.with };
      continue;
    }
    out.unshift({ ...entry.with });
  }
  return out;
}

function normalizeLegacyBassConnectionReplace(
  defaultInputs: InputChannel[],
  replace: InputReplacePatch[] | undefined,
  add: InputChannel[],
): InputReplacePatch[] {
  if ((replace?.length ?? 0) > 0) return replace ?? [];
  const baseMainBass = defaultInputs.find((item) => item.key.startsWith("el_bass_") || item.label === "Electric bass guitar");
  if (!baseMainBass) return [];
  const legacyReplacement = add.find((item) => item.key.startsWith("el_bass_") || item.label === "Electric bass guitar");
  if (!legacyReplacement) return [];
  return [{ targetKey: baseMainBass.key, with: legacyReplacement }];
}

export function validateEffectivePresets(
  effectivePresets: Array<{ group: string; preset: MusicianSetupPreset }>,
): string[] {
  return summarizeEffectivePresetValidation(effectivePresets).errors;
}

export function summarizeEffectivePresetValidation(
  effectivePresets: Array<{ group: string; preset: MusicianSetupPreset }>,
): EffectivePresetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const inputTotal = effectivePresets.reduce(
    (sum, slot) => sum + slot.preset.inputs.length,
    0,
  );
  if (inputTotal > 30) {
    errors.push(`Total input channels exceed limit: ${inputTotal}/30.`);
  }

  const monitorMixTotal = effectivePresets.reduce(
    (sum, slot) => sum + getRequiredMonitorMixCount(slot.preset),
    0,
  );
  if (monitorMixTotal > DEFAULT_MONITOR_MIX_LIMIT) {
    warnings.push(
      `Total required monitor mixes (aux sends) exceed the configured limit (${monitorMixTotal} > ${DEFAULT_MONITOR_MIX_LIMIT}).`,
    );
  }

  let previousRank = -1;
  for (const slot of effectivePresets) {
    const rank = GROUP_ORDER.indexOf(slot.group as (typeof GROUP_ORDER)[number]);
    if (rank === -1) continue;
    if (rank < previousRank) {
      errors.push("Group order must stay fixed: drums, bass, guitar, keys, vocs, talkback.");
      break;
    }
    previousRank = rank;
  }

  return {
    errors,
    warnings,
    totals: {
      inputChannels: inputTotal,
      monitorMixes: monitorMixTotal,
      monitorMixLimit: DEFAULT_MONITOR_MIX_LIMIT,
    },
  };
}

export function buildChangedSummary(
  patch?: PresetOverridePatch,
): string[] {
  if (!patch) return [];
  const added = patch.inputs?.add?.length ?? 0;
  const removed = (patch.inputs?.remove?.length ?? 0) + (patch.inputs?.removeKeys?.length ?? 0);
  const replaced = patch.inputs?.replace?.length ?? 0;
  const updated = patch.inputs?.update?.length ?? 0;
  const out: string[] = [];
  if (added > 0) out.push(`+${added} input` + (added > 1 ? "s" : ""));
  if (removed > 0) out.push(`-${removed} input` + (removed > 1 ? "s" : ""));
  if (replaced > 0) out.push(`${replaced} input replacement` + (replaced > 1 ? "s" : ""));
  if (updated > 0) out.push(`${updated} input update` + (updated > 1 ? "s" : ""));
  if (patch.monitoring) {
    const mode = patch.monitoring.mode;
    const type = patch.monitoring.type === "iem_wired" ? "IEM wired" : patch.monitoring.type === "iem_wireless" ? "IEM wireless" : patch.monitoring.type === "wedge" ? "Wedge" : null;
    if (type || mode) out.push(`Monitoring: ${[type, mode].filter(Boolean).join(" ")}`);
  }
  return out;
}

export function createDefaultMusicianPreset(): MusicianSetupPreset {
  return {
    inputs: [] as InputChannel[],
    monitoring: {
      type: "wedge",
      mode: "mono",
      mixCount: 1,
    },
  };
}
