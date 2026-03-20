import { formatVocalLabel } from "./vocals.js";
import type { Group } from "../model/groups.js";

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

function formatInstrumentGroupLabel(group: Group): string {
  switch (group) {
    case "guitar":
      return "Guitar";
    case "keys":
      return "Keys";
    case "bass":
      return "Bass";
    case "drums":
      return "Drums";
    case "vocs":
      return "Lead vocal";
    case "talkback":
      return "Talkback";
  }
}

export function formatMonitorOwnerLabel(args: {
  ownerRole: Group;
  ownerMusicianId: string;
  fallbackLabel: string;
  leadVocsCount: number;
  leadVocsIndexByMusicianId: Map<string, number>;
  genderByLeadVocsIndex: Array<string | undefined>;
}): string {
  const { ownerRole, ownerMusicianId, fallbackLabel, leadVocsCount, leadVocsIndexByMusicianId, genderByLeadVocsIndex } = args;
  const index = leadVocsIndexByMusicianId.get(ownerMusicianId);
  if (index) {
    return formatVocalLabel({
      role: "lead",
      index,
      gender: genderByLeadVocsIndex[index - 1],
      leadCount: leadVocsCount,
    });
  }
  if (ownerRole === "vocs") return "Lead vocal";
  const mapped = formatInstrumentGroupLabel(ownerRole);
  return mapped || fallbackLabel;
}

export function formatMonitoringLabel(baseMonitoringLabel: string, additionalWedgeCount: number | undefined): string {
  const withSource =
    baseMonitoringLabel.trim().toLowerCase() === "wedge monitor"
      ? `${baseMonitoringLabel} (provided by FOH)`
      : baseMonitoringLabel;
  if (!additionalWedgeCount || additionalWedgeCount <= 0) return withSource;
  return `${withSource} + Additional wedge monitor ${additionalWedgeCount}x`;
}
