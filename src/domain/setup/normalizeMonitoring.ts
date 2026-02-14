import type { MonitoringPreset, PresetOverridePatch } from "../model/types.js";

type LegacyMonitoring = {
  type?: "wedge" | "iem" | "none" | "iem_wired" | "iem_wireless";
  connection?: "wired" | "wireless";
  mode?: "mono" | "stereo";
  mixCount?: number;
};

export function normalizeMonitoringPreset(monitoring?: Partial<MonitoringPreset> | LegacyMonitoring): Partial<MonitoringPreset> | undefined {
  if (!monitoring) return undefined;
  const legacy = monitoring as LegacyMonitoring;
  const normalizedType =
    legacy.type === "iem"
      ? legacy.connection === "wireless"
        ? "iem_wireless"
        : "iem_wired"
      : legacy.type === "none"
        ? "wedge"
        : legacy.type;

  return {
    ...(normalizedType ? { type: normalizedType } : {}),
    ...(legacy.mode ? { mode: legacy.mode } : {}),
    ...(legacy.mixCount !== undefined ? { mixCount: legacy.mixCount } : {}),
  };
}

export function normalizePresetOverridePatch(patch?: PresetOverridePatch): PresetOverridePatch | undefined {
  if (!patch) return undefined;
  return {
    ...patch,
    ...(patch.monitoring ? { monitoring: normalizeMonitoringPreset(patch.monitoring) } : {}),
  };
}
