export const LINEUP_ASSIGNMENT_ROLES = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "vocs",
] as const;

export type LineupRole = (typeof LINEUP_ASSIGNMENT_ROLES)[number];

export type LineupAssignments = Record<LineupRole, string[]>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function dedupeLineupIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function normalizeLineupRoleValue(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  const entries = Array.isArray(value) ? value : [value];
  return dedupeLineupIds(entries.filter(isNonEmptyString));
}

export function normalizeLineupAssignments(value: unknown): LineupAssignments {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return LINEUP_ASSIGNMENT_ROLES.reduce<LineupAssignments>(
    (acc, role) => {
      acc[role] = normalizeLineupRoleValue(source[role]);
      return acc;
    },
    {
      drums: [],
      bass: [],
      guitar: [],
      keys: [],
      vocs: [],
    },
  );
}

export function addMusicianToRole(
  assignments: LineupAssignments,
  role: LineupRole,
  musicianId: string,
): LineupAssignments {
  return addMusiciansToRole(assignments, role, [musicianId]);
}

export function addMusiciansToRole(
  assignments: LineupAssignments,
  role: LineupRole,
  musicianIds: string[],
): LineupAssignments {
  const next = [...assignments[role]];
  const seen = new Set(next);
  for (const musicianId of musicianIds) {
    const trimmed = musicianId.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  if (next.length === assignments[role].length) return assignments;
  return {
    ...assignments,
    [role]: next,
  };
}

export function removeMusicianFromRole(
  assignments: LineupAssignments,
  role: LineupRole,
  musicianId: string,
): LineupAssignments {
  const trimmed = musicianId.trim();
  return {
    ...assignments,
    [role]: assignments[role].filter((id) => id !== trimmed),
  };
}

export function moveMusicianInRole(
  assignments: LineupAssignments,
  role: LineupRole,
  fromIndex: number,
  toIndex: number,
): LineupAssignments {
  const current = assignments[role];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= current.length ||
    toIndex >= current.length ||
    fromIndex === toIndex
  ) {
    return assignments;
  }
  const next = [...current];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return assignments;
  next.splice(toIndex, 0, moved);
  return {
    ...assignments,
    [role]: next,
  };
}
