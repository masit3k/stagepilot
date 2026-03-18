import { formatVocalLabel } from "./vocals.js";
import type { Group } from "../model/groups.js";

function formatOwnerInstrument(ownerRole: Group | undefined): string {
  return ownerRole ?? "vocs";
}

export function formatBackVocalPdfLabel(ownerRole: Group | undefined): string {
  return `Back vocal (${formatOwnerInstrument(ownerRole)})`;
}

export function formatLeadVocalPdfLabel(args: {
  ownerRole: Group | undefined;
  ownerMusicianId: string | undefined;
  leadVocsCount: number;
  leadVocsIndexByMusicianId: Map<string, number>;
  genderByLeadVocsIndex: Array<string | undefined>;
  fallbackLabel: string;
}): string {
  const {
    ownerRole,
    ownerMusicianId,
    leadVocsCount,
    leadVocsIndexByMusicianId,
    genderByLeadVocsIndex,
    fallbackLabel,
  } = args;

  if (!ownerMusicianId) return fallbackLabel;

  if (ownerRole !== "vocs") {
    return `Lead vocal (${formatOwnerInstrument(ownerRole)})`;
  }

  const index = leadVocsIndexByMusicianId.get(ownerMusicianId);
  if (!index) return fallbackLabel;

  return formatVocalLabel({
    role: "lead",
    index,
    gender: genderByLeadVocsIndex[index - 1],
    leadCount: leadVocsCount,
  });
}
