import {
  getUniqueSelectedMusicians,
  type LineupMap,
} from "../../projectRules";
import { serializeLineupForProject } from "./lineupSerialize";
import type { BandSetupData, NewProjectPayload } from "./types";

function normalizeOverlayIds(
  overlays: string[] | undefined | null,
  selectedIds: Set<string>,
): string[] {
  const ids = Array.isArray(overlays)
    ? overlays.map((entry) => entry.trim()).filter(Boolean)
    : [];
  const seen = new Set<string>();
  return ids
    .filter((id) => id.length > 0 && selectedIds.has(id))
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export function buildCanonicalOverlaysFromDefaults(args: {
  setupDefaults: BandSetupData;
  lineup: LineupMap;
  roleOrder: string[];
  talkbackOwnerId?: string;
}): NewProjectPayload["overlays"] | undefined {
  const selectedIds = new Set(
    getUniqueSelectedMusicians(args.lineup, args.roleOrder),
  );
  const leadDefaults =
    args.setupDefaults.defaultOverlays?.leadVocals;
  const backDefaults =
    args.setupDefaults.defaultOverlays?.backVocals;
  const leadVocals = normalizeOverlayIds(leadDefaults, selectedIds);
  const backVocals = normalizeOverlayIds(backDefaults, selectedIds);
  const talkbackOwnerId = (args.talkbackOwnerId ?? "").trim();

  const overlays: NonNullable<NewProjectPayload["overlays"]> = {
    leadVocals,
    backVocals,
    ...(talkbackOwnerId
      ? {
          talkback: {
            mode: "assigned" as const,
            ownerId: talkbackOwnerId,
          },
        }
      : {}),
  };

  return overlays;
}

export function buildCanonicalProjectBaseFromBandDefaults(args: {
  project: NewProjectPayload;
  setupDefaults: BandSetupData;
  roleOrder: string[];
  existingTalkbackOwnerId?: string;
}): NewProjectPayload {
  const lineup = serializeLineupForProject(
    { ...(args.setupDefaults.defaultLineup ?? {}) },
    args.roleOrder,
  );
  const bandLeaderId = (
    args.setupDefaults.bandLeader ??
    args.setupDefaults.bandLeaderId ??
    ""
  ).trim();
  const defaultTalkbackOwnerId = (
    args.setupDefaults.defaultTalkbackOwnerId ??
    bandLeaderId
  ).trim();
  const talkbackOwnerId =
    typeof args.existingTalkbackOwnerId === "string"
      ? args.existingTalkbackOwnerId.trim()
      : defaultTalkbackOwnerId;
  return {
    ...args.project,
    bandLeaderId: bandLeaderId || undefined,
    lineup,
    overlays: buildCanonicalOverlaysFromDefaults({
      setupDefaults: args.setupDefaults,
      lineup,
      roleOrder: args.roleOrder,
      talkbackOwnerId,
    }),
  };
}

export function buildCanonicalProjectFromSetupState(args: {
  project: NewProjectPayload;
  roleOrder: string[];
  lineup: LineupMap;
  bandLeaderId: string;
  talkbackOwnerId: string;
  hasTalkbackOverride: boolean;
  leadVocalIds: string[];
  hasLeadVocalOverride: boolean;
  backVocalIds: string[];
  hasBackVocalOverride: boolean;
}): NewProjectPayload {
  const normalizedTalkbackOwnerId = args.talkbackOwnerId.trim();
  const persistedOverlays: NonNullable<NewProjectPayload["overlays"]> = {
    leadVocals: [...args.leadVocalIds],
    backVocals: [...args.backVocalIds],
    ...(args.hasTalkbackOverride
      ? {
          talkback:
            normalizedTalkbackOwnerId.length > 0
              ? { mode: "assigned" as const, ownerId: normalizedTalkbackOwnerId }
              : { mode: "none" as const, ownerId: null },
        }
      : {}),
  };
  const overlays =
    Object.keys(persistedOverlays).length > 0 ? persistedOverlays : undefined;

  return {
    ...args.project,
    lineup: serializeLineupForProject(args.lineup, args.roleOrder),
    overlays,
    bandLeaderId: args.bandLeaderId || undefined,
  };
}
