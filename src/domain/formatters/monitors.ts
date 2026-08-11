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
        roleCount: ctx.leadCount,
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
  backVocsCount: number;
  backVocsIndexByMusicianId: Map<string, number>;
  genderByBackVocsIndex: Array<string | undefined>;
}): string {
  const {
    ownerRole,
    ownerMusicianId,
    fallbackLabel,
    leadVocsCount,
    leadVocsIndexByMusicianId,
    genderByLeadVocsIndex,
    backVocsCount,
    backVocsIndexByMusicianId,
    genderByBackVocsIndex,
  } = args;
  if (ownerRole !== "vocs") {
    const mapped = formatInstrumentGroupLabel(ownerRole);
    return mapped || fallbackLabel;
  }

  const leadIndex = leadVocsIndexByMusicianId.get(ownerMusicianId);
  if (leadIndex) {
    return formatVocalLabel({
      role: "lead",
      index: leadIndex,
      gender: genderByLeadVocsIndex[leadIndex - 1],
      roleCount: leadVocsCount,
    });
  }

  const backIndex = backVocsIndexByMusicianId.get(ownerMusicianId);
  if (backIndex) {
    return formatVocalLabel({
      role: "back",
      index: backIndex,
      gender: genderByBackVocsIndex[backIndex - 1],
      roleCount: backVocsCount,
    });
  }

  return "Lead vocal";
}

export function formatMonitoringLabel(baseMonitoringLabel: string, additionalWedgeCount: number | undefined): string {
  if (!additionalWedgeCount || additionalWedgeCount <= 0) return baseMonitoringLabel;
  return `${baseMonitoringLabel} + Additional wedge monitor ${additionalWedgeCount}x`;
}
