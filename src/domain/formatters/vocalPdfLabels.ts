import type { Group } from "../model/groups.js";
import { formatVocalLabel } from "./vocals.js";

export type VocalRole = "lead" | "back";

type SlottedVocalMetadata = {
  count: number;
  slotByMusicianId: Map<string, number>;
  genderBySlot: Array<string | undefined>;
};

function formatOwnerDescriptor(ownerRole: Group | undefined, gender: string | undefined): string {
  if (ownerRole !== "vocs") return ownerRole ?? "vocs";
  if (gender === "m") return "male";
  if (gender === "f") return "female";
  return "vocs";
}

function formatIndexedVocalPdfLabel(args: {
  role: VocalRole;
  ownerRole: Group | undefined;
  ownerMusicianId: string | undefined;
  fallbackLabel: string;
  metadata: SlottedVocalMetadata;
}): string {
  const { role, ownerRole, ownerMusicianId, fallbackLabel, metadata } = args;
  if (!ownerMusicianId) return fallbackLabel;

  const slot = metadata.slotByMusicianId.get(ownerMusicianId);
  if (!slot) return fallbackLabel;

  const gender = metadata.genderBySlot[slot - 1];
  if (ownerRole === "vocs") {
    return formatVocalLabel({
      role,
      index: slot,
      roleCount: metadata.count,
      gender,
    });
  }

  const ownerDescriptor = formatOwnerDescriptor(ownerRole, gender);
  if (role === "lead" && metadata.count === 1) return "Lead vocal";
  if (role === "back" && metadata.count === 1) return `Back vocal (${ownerDescriptor})`;

  return `${role === "lead" ? "Lead vocal" : "Back vocal"} ${slot} (${ownerDescriptor})`;
}

export function formatLeadVocalPdfLabel(args: {
  ownerRole: Group | undefined;
  ownerMusicianId: string | undefined;
  leadVocsCount: number;
  leadVocsSlotByMusicianId: Map<string, number>;
  genderByLeadVocsSlot: Array<string | undefined>;
  fallbackLabel: string;
}): string {
  return formatIndexedVocalPdfLabel({
    role: "lead",
    ownerRole: args.ownerRole,
    ownerMusicianId: args.ownerMusicianId,
    fallbackLabel: args.fallbackLabel,
    metadata: {
      count: args.leadVocsCount,
      slotByMusicianId: args.leadVocsSlotByMusicianId,
      genderBySlot: args.genderByLeadVocsSlot,
    },
  });
}

export function formatBackVocalPdfLabel(args: {
  ownerRole: Group | undefined;
  ownerMusicianId: string | undefined;
  backVocsCount: number;
  backVocsSlotByMusicianId: Map<string, number>;
  genderByBackVocsSlot: Array<string | undefined>;
  fallbackLabel: string;
}): string {
  return formatIndexedVocalPdfLabel({
    role: "back",
    ownerRole: args.ownerRole,
    ownerMusicianId: args.ownerMusicianId,
    fallbackLabel: args.fallbackLabel,
    metadata: {
      count: args.backVocsCount,
      slotByMusicianId: args.backVocsSlotByMusicianId,
      genderBySlot: args.genderByBackVocsSlot,
    },
  });
}
