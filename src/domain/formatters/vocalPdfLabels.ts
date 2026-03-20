import type { Group } from "../model/groups.js";
import { formatVocalLabel } from "./vocals.js";

export type VocalRole = "lead" | "back";

type IndexedVocalMetadata = {
  count: number;
  indexByMusicianId: Map<string, number>;
  genderByIndex: Array<string | undefined>;
};

function formatOwnerInstrument(ownerRole: Group | undefined): string {
  return ownerRole ?? "vocs";
}

export function formatIndexedVocalPdfLabel(args: {
  role: VocalRole;
  ownerRole: Group | undefined;
  ownerMusicianId: string | undefined;
  fallbackLabel: string;
  metadata: IndexedVocalMetadata;
}): string {
  const { role, ownerRole, ownerMusicianId, fallbackLabel, metadata } = args;
  if (!ownerMusicianId) return fallbackLabel;

  const index = metadata.indexByMusicianId.get(ownerMusicianId);
  if (!index) return fallbackLabel;

  if (ownerRole === "vocs") {
    return formatVocalLabel({
      role,
      index,
      roleCount: metadata.count,
      gender: metadata.genderByIndex[index - 1],
    });
  }

  return `${role === "lead" ? "Lead vocal" : "Back vocal"} ${index} (${formatOwnerInstrument(ownerRole)})`;
}

export function formatLeadVocalPdfLabel(args: {
  ownerRole: Group | undefined;
  ownerMusicianId: string | undefined;
  leadVocsCount: number;
  leadVocsIndexByMusicianId: Map<string, number>;
  genderByLeadVocsIndex: Array<string | undefined>;
  fallbackLabel: string;
}): string {
  return formatIndexedVocalPdfLabel({
    role: "lead",
    ownerRole: args.ownerRole,
    ownerMusicianId: args.ownerMusicianId,
    fallbackLabel: args.fallbackLabel,
    metadata: {
      count: args.leadVocsCount,
      indexByMusicianId: args.leadVocsIndexByMusicianId,
      genderByIndex: args.genderByLeadVocsIndex,
    },
  });
}

export function formatBackVocalPdfLabel(args: {
  ownerRole: Group | undefined;
  ownerMusicianId: string | undefined;
  backVocsCount: number;
  backVocsIndexByMusicianId: Map<string, number>;
  genderByBackVocsIndex: Array<string | undefined>;
  fallbackLabel: string;
}): string {
  return formatIndexedVocalPdfLabel({
    role: "back",
    ownerRole: args.ownerRole,
    ownerMusicianId: args.ownerMusicianId,
    fallbackLabel: args.fallbackLabel,
    metadata: {
      count: args.backVocsCount,
      indexByMusicianId: args.backVocsIndexByMusicianId,
      genderByIndex: args.genderByBackVocsIndex,
    },
  });
}
