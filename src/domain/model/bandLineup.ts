import { GROUP_ORDER, type Group } from "./groups.js";
import type { Band, DefaultLineup, DefaultVocals } from "./types.js";

export function getLineupGroupMemberIds(lineup: DefaultLineup, group: Group): string[] {
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

export function getLineupMembersByGroup(lineup: DefaultLineup): Record<Group, string[]> {
  return GROUP_ORDER.reduce(
    (acc, group) => ({ ...acc, [group]: getLineupGroupMemberIds(lineup, group) }),
    {} as Record<Group, string[]>,
  );
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of musician ids.`);
  }
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${path}[${index}] must be a non-empty musician id string.`);
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
        throw new Error(`defaultLineup.${group} contains duplicate musician '${musicianId}'.`);
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

export function validateDefaultVocals(args: {
  lineup: DefaultLineup;
  vocals: DefaultVocals;
}): void {
  const lineupIds = new Set(getAllLineupMemberIds(args.lineup));
  assertStringArray(args.vocals.lead, "defaultVocals.lead");
  assertStringArray(args.vocals.back, "defaultVocals.back");

  const leadSet = new Set<string>();
  for (const musicianId of args.vocals.lead) {
    if (leadSet.has(musicianId)) {
      throw new Error(`defaultVocals.lead contains duplicate musician '${musicianId}'.`);
    }
    leadSet.add(musicianId);
    if (!lineupIds.has(musicianId)) {
      throw new Error(`defaultVocals.lead contains '${musicianId}' not present in defaultLineup.`);
    }
  }

  const backSet = new Set<string>();
  for (const musicianId of args.vocals.back) {
    if (backSet.has(musicianId)) {
      throw new Error(`defaultVocals.back contains duplicate musician '${musicianId}'.`);
    }
    if (leadSet.has(musicianId)) {
      throw new Error(`Musician '${musicianId}' cannot be in both defaultVocals.lead and defaultVocals.back.`);
    }
    backSet.add(musicianId);
    if (!lineupIds.has(musicianId)) {
      throw new Error(`defaultVocals.back contains '${musicianId}' not present in defaultLineup.`);
    }
  }
}

export function validateCanonicalBandModel(band: Band): void {
  if (!band.defaultVocals) {
    throw new Error("Band must define defaultVocals with lead/back arrays.");
  }
  validateDefaultLineup(band.defaultLineup ?? {});
  validateDefaultVocals({
    lineup: band.defaultLineup ?? {},
    vocals: band.defaultVocals,
  });
}
