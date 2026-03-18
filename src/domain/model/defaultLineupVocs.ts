import type { Group, LineupValue } from "./types.js";

export type GenericLineup = Record<string, unknown>;

const LEGACY_VOCAL_MEMBERSHIP_KEYS = ["lead_vocs", "lead_voc"] as const;

function normalizeLineupIds(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => normalizeLineupIds(entry))
      .filter((entry, index, all) => all.indexOf(entry) === index);
  }
  if (value && typeof value === "object") {
    const musicianId = (value as { musicianId?: unknown }).musicianId;
    return typeof musicianId === "string" && musicianId.trim() ? [musicianId.trim()] : [];
  }
  return [];
}

function asLineupValue(ids: string[]): LineupValue | undefined {
  if (ids.length === 0) return undefined;
  if (ids.length === 1) return ids[0];
  return ids;
}

function mergeUnique(base: string[], appended: string[]): string[] {
  const seen = new Set(base);
  const merged = [...base];
  for (const id of appended) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}

export function withLegacyVocalMembershipInDefaultLineup(
  lineup: GenericLineup,
): GenericLineup {
  const normalized = { ...lineup };

  const existingVocs = normalizeLineupIds(normalized.vocs);
  let mergedVocs = [...existingVocs];

  for (const key of LEGACY_VOCAL_MEMBERSHIP_KEYS) {
    mergedVocs = mergeUnique(mergedVocs, normalizeLineupIds(normalized[key]));
  }

  const lineupValue = asLineupValue(mergedVocs);
  if (lineupValue !== undefined) normalized.vocs = lineupValue;

  return normalized;
}

export function migrateBandDefaultLineupVocs(args: {
  defaultLineup: GenericLineup;
  resolveMusicianGroup: (musicianId: string) => Group | undefined;
}): {
  defaultLineup: GenericLineup;
  addedVocalMembers: string[];
  changed: boolean;
} {
  const normalized = { ...args.defaultLineup };
  const existingVocs = normalizeLineupIds(normalized.vocs);
  const vocalSelectionUnion = [
    ...normalizeLineupIds(normalized.lead_vocs),
    ...normalizeLineupIds(normalized.back_vocs),
  ];

  const seen = new Set(existingVocs);
  const addedVocalMembers: string[] = [];

  for (const musicianId of vocalSelectionUnion) {
    if (seen.has(musicianId)) continue;
    if (args.resolveMusicianGroup(musicianId) !== "vocs") continue;
    seen.add(musicianId);
    addedVocalMembers.push(musicianId);
  }

  const nextVocs = [...existingVocs, ...addedVocalMembers];
  const beforeVocs = normalizeLineupIds(args.defaultLineup.vocs);
  const changed =
    addedVocalMembers.length > 0 ||
    beforeVocs.length !== nextVocs.length ||
    beforeVocs.some((id, index) => id !== nextVocs[index]);

  return {
    defaultLineup: {
      ...normalized,
      ...(nextVocs.length > 0 ? { vocs: nextVocs } : {}),
    },
    addedVocalMembers,
    changed,
  };
}
