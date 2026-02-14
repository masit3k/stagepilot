import { GROUP_ORDER } from "../model/groups.js";
import type {
  InputChannel,
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../model/types.js";

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

  const remove = new Set(patch.inputs?.removeKeys ?? []);
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

  for (const add of patch.inputs?.add ?? []) {
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

export function validateEffectivePresets(
  effectivePresets: Array<{ group: string; preset: MusicianSetupPreset }>,
): string[] {
  const errors: string[] = [];
  const inputTotal = effectivePresets.reduce(
    (sum, slot) => sum + slot.preset.inputs.length,
    0,
  );
  if (inputTotal > 30) {
    errors.push(`Total input channels exceed limit: ${inputTotal}/30.`);
  }

  const monitorMixTotal = effectivePresets.reduce(
    (sum, slot) => sum + (slot.preset.monitoring.mixCount ?? 0),
    0,
  );
  if (monitorMixTotal > 6) {
    errors.push(`Total monitor mixes exceed limit: ${monitorMixTotal}/6.`);
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

  return errors;
}

export function buildChangedSummary(
  patch?: PresetOverridePatch,
): string[] {
  if (!patch) return [];
  const added = patch.inputs?.add?.length ?? 0;
  const removed = patch.inputs?.removeKeys?.length ?? 0;
  const updated = patch.inputs?.update?.length ?? 0;
  const out: string[] = [];
  if (added > 0) out.push(`+${added} input` + (added > 1 ? "s" : ""));
  if (removed > 0) out.push(`-${removed} input` + (removed > 1 ? "s" : ""));
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
