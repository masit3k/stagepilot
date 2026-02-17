import type { Monitor } from "../model/types.js";

export type MonitorPresetIndex = Record<string, Pick<Monitor, "id" | "label">>;

export function getMonitorLabel(monitorsById: MonitorPresetIndex, monitorRef: string): string {
  const monitor = monitorsById[monitorRef];
  if (!monitor) {
    throw new Error(`Unknown monitor preset ref: ${monitorRef}`);
  }
  return monitor.label;
}
