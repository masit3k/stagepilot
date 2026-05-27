import { normalizeLineupAssignments } from "../lineup/lineupAssignments.js";
import { GROUP_ORDER, type Group } from "./groups.js";
import type { Band, DefaultLineup, DefaultOverlays } from "./types.js";

export function getLineupGroupMemberIds(
  lineup: DefaultLineup,
  group: Group,
): string[] {
  return [...(lineup[group] ?? [])];
}

export function getAllLineupMemberIds(lineup: DefaultLineup): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const group of GROUP_ORDER) {
    for (const musicianId of lineup[group] ?? []) {
      if (seen.has(musicianId)) continue;
      seen.add(musicianId);
      ordered.push(musicianId);
    }
  }
  return ordered;
}

export function getLineupMembersByGroup(
  lineup: DefaultLineup,
): Record<Group, string[]> {
  const grouped = {} as Record<Group, string[]>;
  for (const group of GROUP_ORDER) {
    grouped[group] = getLineupGroupMemberIds(lineup, group);
  }
  return grouped;
}

function assertStringArray(
  value: unknown,
  path: string,
): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of musician ids.`);
  }
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(
        `${path}[${index}] must be a non-empty musician id string.`,
      );
    }
  }
}

export function validateDefaultLineup(lineup: DefaultLineup): void {
  const ownerById = new Map<string, Group>();
  for (const group of GROUP_ORDER) {
    const ids = lineup[group] ?? [];
    assertStringArray(ids, `defaultLineup.${group}`);
    const seenWithinGroup = new Set<string>();
    for (const musicianId of ids) {
      if (seenWithinGroup.has(musicianId)) {
        throw new Error(
          `defaultLineup.${group} contains duplicate musician '${musicianId}'.`,
        );
      }
      seenWithinGroup.add(musicianId);
      const existingGroup = ownerById.get(musicianId);
      if (existingGroup) {
        throw new Error(
          `Musician '${musicianId}' is assigned to multiple lineup groups: '${existingGroup}' and '${group}'.`,
        );
      }
      ownerById.set(musicianId, group);
    }
  }
}

function normalizeOverlayIds(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${path}[${index}] must be a non-empty musician id string.`);
    }
    return entry.trim();
  });
}

export function validateDefaultVocals(args: {
  lineup: DefaultLineup;
  vocals: DefaultOverlays;
}): void {
  const lineupIds = new Set(getAllLineupMemberIds(args.lineup));
  const leadVocals = normalizeOverlayIds(
    args.vocals.leadVocals ?? [],
    "defaultOverlays.leadVocals",
  );
  const backVocals = normalizeOverlayIds(
    args.vocals.backVocals ?? [],
    "defaultOverlays.backVocals",
  );

  const leadSet = new Set<string>();
  for (const musicianId of leadVocals) {
    if (leadSet.has(musicianId)) {
      throw new Error(
        `defaultOverlays.leadVocals contains duplicate musician '${musicianId}'.`,
      );
    }
    leadSet.add(musicianId);
    if (!lineupIds.has(musicianId)) {
      throw new Error(
        `defaultOverlays.leadVocals contains '${musicianId}' not present in defaultLineup.`,
      );
    }
  }

  const backSet = new Set<string>();
  for (const musicianId of backVocals) {
    if (backSet.has(musicianId)) {
      throw new Error(
        `defaultOverlays.backVocals contains duplicate musician '${musicianId}'.`,
      );
    }
    if (leadSet.has(musicianId)) {
      throw new Error(
        `Musician '${musicianId}' cannot be in both defaultOverlays.leadVocals and defaultOverlays.backVocals.`,
      );
    }
    backSet.add(musicianId);
    if (!lineupIds.has(musicianId)) {
      throw new Error(
        `defaultOverlays.backVocals contains '${musicianId}' not present in defaultLineup.`,
      );
    }
  }
}

export function normalizeBandToCanonicalShape(band: Band): Band {
  const defaultLineup = normalizeLineupAssignments(band.defaultLineup ?? {});
  const defaultOverlays = (band.defaultOverlays ?? {}) as DefaultOverlays;
  const leadVocals = normalizeOverlayIds(
    defaultOverlays.leadVocals ?? [],
    "defaultOverlays.leadVocals",
  );
  const backVocals = normalizeOverlayIds(
    defaultOverlays.backVocals ?? [],
    "defaultOverlays.backVocals",
  );
  const primaryBandLeader =
    typeof band.bandLeader === "string" ? band.bandLeader.trim() : "";
  const fallbackBandLeader =
    typeof band.bandLeaderId === "string" ? band.bandLeaderId.trim() : "";
  const bandLeader = primaryBandLeader || fallbackBandLeader;
  return {
    ...band,
    bandLeader,
    bandLeaderId: bandLeader,
    defaultLineup,
    defaultTalkbackOwnerId: (band.defaultTalkbackOwnerId ?? bandLeader).trim(),
    defaultOverlays: { leadVocals, backVocals },
  };
}

export function validateCanonicalBandModel(band: Band): void {
  const defaultOverlays = band.defaultOverlays;
  if (!defaultOverlays)
    throw new Error(
      "Band must define defaultOverlays with leadVocals/backVocals arrays.",
    );
  validateDefaultLineup(band.defaultLineup ?? {});
  validateDefaultVocals({
    lineup: band.defaultLineup ?? {},
    vocals: defaultOverlays,
  });
}
