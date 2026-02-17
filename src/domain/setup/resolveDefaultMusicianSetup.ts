import type { Group } from "../model/groups.js";
import type {
  InputChannel,
  Monitor,
  MonitoringPreset,
  MusicianSetupPreset,
  Preset,
  PresetEntity,
  PresetItem,
} from "../model/types.js";
import { createDefaultMusicianPreset } from "../rules/presetOverride.js";
import { orderInputs } from "./orderInputs.js";

const BASS_MAIN_PRIORITY = ["el_bass_xlr_pedalboard", "el_bass_xlr_amp"] as const;

function dedupeInputs(inputs: InputChannel[]): InputChannel[] {
  const byKey = new Map<string, InputChannel>();
  for (const input of inputs) {
    if (!byKey.has(input.key)) byKey.set(input.key, { ...input });
  }
  return Array.from(byKey.values());
}

function toMonitoringPreset(entity: Monitor): MonitoringPreset {
  if (entity.wireless === true) {
    return {
      type: "iem_wireless",
      mode: entity.mode ?? "mono",
      mixCount: 1,
    };
  }
  if (entity.id.startsWith("iem")) {
    return {
      type: "iem_wired",
      mode: entity.mode ?? "mono",
      mixCount: 1,
    };
  }
  return {
    type: "wedge",
    mode: "mono",
    mixCount: 1,
  };
}

type SetupPreset = Preset & { setupGroup?: string };

function selectBassMainPreset(presets: SetupPreset[]): SetupPreset | undefined {
  const mains = presets.filter((preset) => preset.setupGroup === "electric_bass");
  if (mains.length === 0) return undefined;
  const rank = (id: string): number => {
    const index = BASS_MAIN_PRIORITY.indexOf(id as (typeof BASS_MAIN_PRIORITY)[number]);
    return index >= 0 ? index : Number.POSITIVE_INFINITY;
  };
  return [...mains].sort((a, b) => {
    const byPriority = rank(a.id) - rank(b.id);
    if (byPriority !== 0) return byPriority;
    return a.id.localeCompare(b.id);
  })[0];
}

export function resolveDefaultMusicianSetup(args: {
  role: Group;
  presetItems?: PresetItem[];
  musicianDefaults?: Partial<MusicianSetupPreset>;
  bandDefaults?: Partial<MusicianSetupPreset>;
  getPresetByRef: (ref: string) => PresetEntity | undefined;
}): MusicianSetupPreset {
  const fallback = createDefaultMusicianPreset();
  const resolvedMonitoring: MonitoringPreset = {
    ...fallback.monitoring,
    ...(args.bandDefaults?.monitoring ?? {}),
    ...(args.musicianDefaults?.monitoring ?? {}),
  };

  const presetEntities = (args.presetItems ?? [])
    .filter((item): item is Extract<PresetItem, { kind: "preset" }> => item.kind === "preset")
    .map((item) => args.getPresetByRef(item.ref))
    .filter((entity): entity is SetupPreset => Boolean(entity) && entity.type === "preset" && entity.group === args.role);

  const monitorEntity = (args.presetItems ?? [])
    .filter((item): item is Extract<PresetItem, { kind: "monitor" }> => item.kind === "monitor")
    .map((item) => args.getPresetByRef(item.ref))
    .find((entity): entity is Monitor => Boolean(entity) && entity.type === "monitor");

  const inputsFromPresets =
    args.role === "bass"
      ? (() => {
          const chosenMain = selectBassMainPreset(presetEntities);
          const optional = presetEntities.filter((preset) => preset.setupGroup !== "electric_bass");
          const ordered = [
            ...(chosenMain?.inputs ?? []),
            ...optional.flatMap((preset) => preset.inputs),
          ];
          return dedupeInputs(ordered);
        })()
      : dedupeInputs(presetEntities.flatMap((preset) => preset.inputs));

  const baseInputs =
    inputsFromPresets.length > 0
      ? inputsFromPresets
      : (args.musicianDefaults?.inputs ?? args.bandDefaults?.inputs ?? fallback.inputs);

  return {
    inputs: orderInputs(baseInputs.map((input) => ({ ...input })), args.role),
    monitoring: monitorEntity ? { ...resolvedMonitoring, ...toMonitoringPreset(monitorEntity) } : resolvedMonitoring,
  };
}
