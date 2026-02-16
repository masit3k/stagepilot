import {
  type LineupMap,
  type LineupSlotValue,
  normalizeLineupValue,
  normalizeLineupSlots,
  normalizeRoleConstraint,
} from "../../projectRules";

export function serializeLineupForProject(
  lineup: LineupMap,
  constraints: Record<string, { min: number; max: number }>,
  roleOrder: string[],
): LineupMap {
  const serialized: LineupMap = {};

  for (const role of roleOrder) {
    const persistRole = role === "vocs" ? "lead_vocs" : role;
    const roleConstraint = normalizeRoleConstraint(role, constraints[role]);
    const slots = normalizeLineupSlots(lineup[role], roleConstraint.max);
    const hasOverrides = slots.some((slot) => Boolean(slot.presetOverride));

    if (hasOverrides) {
      const entry: LineupSlotValue[] = slots.map((slot) => ({
        musicianId: slot.musicianId,
        ...(slot.presetOverride ? { presetOverride: slot.presetOverride } : {}),
      }));
      if (entry.length === 0) continue;
      serialized[persistRole] = roleConstraint.max <= 1 ? entry[0] : entry;
      continue;
    }

    const ids = normalizeLineupValue(lineup[role], roleConstraint.max);
    if (ids.length === 0) continue;
    serialized[persistRole] = roleConstraint.max <= 1 ? ids[0] : ids;
  }

  if (lineup.back_vocs !== undefined) {
    serialized.back_vocs = lineup.back_vocs;
  }

  return serialized;
}
