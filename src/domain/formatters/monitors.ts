import { formatVocalLabel } from "./vocals.js";

export type MonitorChannel =
  | { kind: "guitar" }
  | { kind: "keys" }
  | { kind: "bass" }
  | { kind: "drums" }
  | { kind: "lead"; index: number; gender?: string };

export function formatMonitorLabel(channel: MonitorChannel, ctx: { leadCount: number }): string {
  switch (channel.kind) {
    case "guitar":
      return "Guitar";
    case "keys":
      return "Keys";
    case "bass":
      return "Bass";
    case "drums":
      return "Drums";
    case "lead":
      return formatVocalLabel({
        role: "lead",
        index: channel.index,
        gender: channel.gender,
        leadCount: ctx.leadCount,
      });
  }
}

export function formatMonitoringLabel(baseMonitoringLabel: string, additionalWedgeCount: number | undefined): string {
  const withSource =
    baseMonitoringLabel.trim().toLowerCase() === "wedge monitor"
      ? `${baseMonitoringLabel} (provided by FOH)`
      : baseMonitoringLabel;
  if (!additionalWedgeCount || additionalWedgeCount <= 0) return withSource;
  return `${withSource} + Additional wedge monitor ${additionalWedgeCount}x`;
}
