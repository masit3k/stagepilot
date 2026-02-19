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

const BASS_MAIN_CONNECTION_KEYS = new Set(["el_bass_xlr_amp", "el_bass_xlr_pedalboard"]);

function normalizePatchShape(patch: PresetOverridePatch): PresetOverridePatch {
  const add = patch.inputs?.add?.length ? patch.inputs.add : undefined;
  const remove = patch.inputs?.remove?.length ? patch.inputs.remove : undefined;
  const removeKeys = patch.inputs?.removeKeys?.length ? patch.inputs.removeKeys : undefined;
  const replace = patch.inputs?.replace?.length ? patch.inputs.replace : undefined;
  const update = patch.inputs?.update?.length ? patch.inputs.update : undefined;
  const normalizedMonitoring = patch.monitoring
    ? {
      ...patch.monitoring,
      ...(patch.monitoring.additionalWedgeCount !== undefined && patch.monitoring.additionalWedgeCount > 0
        ? { additionalWedgeCount: patch.monitoring.additionalWedgeCount }
        : { additionalWedgeCount: undefined }),
    }
    : undefined;
  const monitoring = normalizedMonitoring && Object.keys(normalizedMonitoring).some((key) =>
    normalizedMonitoring[key as keyof typeof normalizedMonitoring] !== undefined,
  )
    ? normalizedMonitoring
    : undefined;
  const inputs = add || remove || removeKeys || replace || update
    ? {
      ...(add ? { add } : {}),
      ...(remove ? { remove } : {}),
      ...(removeKeys ? { removeKeys } : {}),
      ...(replace ? { replace } : {}),
      ...(update ? { update } : {}),
    }
    : undefined;
  return {
    ...(inputs ? { inputs } : {}),
    ...(monitoring ? { monitoring } : {}),
  };
}

export function normalizeBassConnectionOverridePatch(
  defaultPreset: MusicianSetupPreset,
  patch?: PresetOverridePatch | null,
): PresetOverridePatch | undefined {
  if (!patch) return undefined;
  const defaultMainBass = defaultPreset.inputs.find((item) => BASS_MAIN_CONNECTION_KEYS.has(item.key));
  if (!defaultMainBass) return normalizePatchShape(patch);

  const add = patch.inputs?.add ?? [];
  const replace = patch.inputs?.replace ?? [];
  const legacyReplacement = add.find((item) => BASS_MAIN_CONNECTION_KEYS.has(item.key));

  const normalizedAdd = add.filter((item) => !BASS_MAIN_CONNECTION_KEYS.has(item.key));
  const normalizedReplace = replace.length > 0
    ? replace
    : legacyReplacement
      ? [{ targetKey: defaultMainBass.key, with: legacyReplacement }]
      : [];

  return normalizePatchShape({
    ...patch,
    inputs: {
      ...patch.inputs,
      add: normalizedAdd,
      replace: normalizedReplace,
    },
  });
}

function presetsEqual(a: MusicianSetupPreset, b: MusicianSetupPreset): boolean {
  if (a.monitoring.monitorRef !== b.monitoring.monitorRef) return false;
  if ((a.monitoring.additionalWedgeCount ?? 0) !== (b.monitoring.additionalWedgeCount ?? 0)) return false;
  if (a.inputs.length !== b.inputs.length) return false;
  return a.inputs.every((input, index) => {
    const other = b.inputs[index];
    return input.key === other?.key
      && input.label === other?.label
      && input.note === other?.note
      && input.group === other?.group;
  });
}

export function normalizeSetupOverridePatch(
  defaultPreset: MusicianSetupPreset,
  patch?: PresetOverridePatch | null,
): PresetOverridePatch | undefined {
  const normalizedPatch = normalizeBassConnectionOverridePatch(defaultPreset, patch);
  if (!normalizedPatch) return undefined;
  const effective = applyPresetOverride(defaultPreset, normalizedPatch, true);
  return presetsEqual(defaultPreset, effective) ? undefined : normalizedPatch;
}

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
  if (preset.monitoring.monitorRef === "wedge") return 0;
  return 1;
}

export function applyPresetOverride(
  defaultPreset: MusicianSetupPreset,
  patch?: PresetOverridePatch | null,
  skipNormalization = false,
): MusicianSetupPreset {
  const base: MusicianSetupPreset = {
    inputs: defaultPreset.inputs.map((input) => ({ ...input })),
    monitoring: { ...defaultPreset.monitoring },
  };
  const normalizedPatch = skipNormalization
    ? (patch ? normalizePatchShape(patch) : undefined)
    : normalizeSetupOverridePatch(defaultPreset, patch);
  if (!normalizedPatch) return base;

  if (normalizedPatch.monitoring) {
    base.monitoring = {
      ...base.monitoring,
      ...normalizedPatch.monitoring,
    };
  }

  const remove = new Set([...(normalizedPatch.inputs?.remove ?? []), ...(normalizedPatch.inputs?.removeKeys ?? [])]);
  let inputs = base.inputs.filter((input) => !remove.has(input.key));

  for (const update of normalizedPatch.inputs?.update ?? []) {
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

  inputs = applyInputReplacements(inputs, normalizedPatch.inputs?.replace ?? []);

  const replacementKeys = new Set((normalizedPatch.inputs?.replace ?? []).map((entry) => entry.with.key));
  for (const add of normalizedPatch.inputs?.add ?? []) {
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
    const monitorRef = patch.monitoring.monitorRef;
    if (monitorRef) out.push(`Monitoring: ${monitorRef}`);
    if (patch.monitoring.additionalWedgeCount !== undefined) {
      out.push(`Additional wedge monitor ${patch.monitoring.additionalWedgeCount}x`);
    }
  }
  return out;
}

export function createDefaultMusicianPreset(): MusicianSetupPreset {
  return {
    inputs: [] as InputChannel[],
    monitoring: {
      monitorRef: "wedge",
    },
  };
}
