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

/**
 * The one place that decides whether `formatIndexedVocalPdfLabel` recomputes
 * a row's label at all. `undefined` means it doesn't — the two conditions
 * below (`formatIndexedVocalPdfLabel`'s `!ownerMusicianId` and `!slot` early
 * returns) are exactly the cases where the row prints whatever `fallbackLabel`
 * it was given instead. `isLeadVocalLabelCanonical`/`isBackVocalLabelCanonical`
 * below share this so a "canonical" flag derived from it can never drift from
 * what the formatter actually does (task 12c fix round 1, Minor 5).
 */
function resolveVocalSlot(
  ownerMusicianId: string | undefined,
  slotByMusicianId: Map<string, number>,
): number | undefined {
  if (!ownerMusicianId) return undefined;
  return slotByMusicianId.get(ownerMusicianId);
}

function formatIndexedVocalPdfLabel(args: {
  role: VocalRole;
  ownerRole: Group | undefined;
  ownerMusicianId: string | undefined;
  fallbackLabel: string;
  metadata: SlottedVocalMetadata;
}): string {
  const { role, ownerRole, fallbackLabel, metadata } = args;
  const slot = resolveVocalSlot(args.ownerMusicianId, metadata.slotByMusicianId);
  if (slot === undefined) return fallbackLabel;

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

/**
 * True exactly when `formatLeadVocalPdfLabel` would recompute this row's
 * label instead of printing `fallbackLabel` verbatim (task 12c fix round 1,
 * Minor 5) — shares `resolveVocalSlot` with the formatter so the two can't
 * drift apart.
 */
export function isLeadVocalLabelCanonical(args: {
  ownerMusicianId: string | undefined;
  leadVocsSlotByMusicianId: Map<string, number>;
}): boolean {
  return resolveVocalSlot(args.ownerMusicianId, args.leadVocsSlotByMusicianId) !== undefined;
}

/** Same as `isLeadVocalLabelCanonical`, for `formatBackVocalPdfLabel`. */
export function isBackVocalLabelCanonical(args: {
  ownerMusicianId: string | undefined;
  backVocsSlotByMusicianId: Map<string, number>;
}): boolean {
  return resolveVocalSlot(args.ownerMusicianId, args.backVocsSlotByMusicianId) !== undefined;
}
