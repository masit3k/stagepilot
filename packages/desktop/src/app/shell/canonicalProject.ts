import {
  getUniqueSelectedMusicians,
  type LineupMap,
} from "../../projectRules";
import { serializeLineupForProject } from "./lineupSerialize";
import type { BandSetupData, NewProjectPayload } from "./types";

function toOverlaySlots(ids: string[]) {
  return ids.map((musicianId, index) => ({ slot: index + 1, musicianId }));
}

function normalizeOverlayIds(ids: string[], selectedIds: Set<string>): string[] {
  const seen = new Set<string>();
  return ids
    .map((id) => id.trim())
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
  const leadVocals = normalizeOverlayIds(
    args.setupDefaults.defaultOverlays?.leadVocals ?? [],
    selectedIds,
  );
  const backVocals = normalizeOverlayIds(
    args.setupDefaults.defaultOverlays?.backVocals ?? [],
    selectedIds,
  );
  const talkbackOwnerId = (args.talkbackOwnerId ?? "").trim();

  const overlays: NonNullable<NewProjectPayload["overlays"]> = {
    ...(leadVocals.length > 0 ? { leadVocals: toOverlaySlots(leadVocals) } : {}),
    ...(backVocals.length > 0 ? { backVocals: toOverlaySlots(backVocals) } : {}),
    ...(talkbackOwnerId
      ? {
          talkback: {
            mode: "assigned" as const,
            ownerId: talkbackOwnerId,
          },
        }
      : {}),
  };

  return Object.keys(overlays).length > 0 ? overlays : undefined;
}

export function buildCanonicalProjectFromSetupState(args: {
  project: NewProjectPayload;
  roleOrder: string[];
  lineup: LineupMap;
  bandLeaderId: string;
  talkbackOwnerId: string;
  hasTalkbackOverride: boolean;
  leadVocalistIds: string[];
  hasLeadVocalOverride: boolean;
  backVocalIds: string[];
  hasBackVocalOverride: boolean;
}): NewProjectPayload {
  const normalizedTalkbackOwnerId = args.talkbackOwnerId.trim();
  const persistedOverlays: NonNullable<NewProjectPayload["overlays"]> = {
    ...(args.hasLeadVocalOverride
      ? { leadVocals: toOverlaySlots([...args.leadVocalistIds]) }
      : {}),
    ...(args.hasBackVocalOverride
      ? { backVocals: toOverlaySlots([...args.backVocalIds]) }
      : {}),
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
    talkbackOwnerId: normalizedTalkbackOwnerId,
    leadVocalistIds: undefined,
    backVocalIds: undefined,
  };
}
