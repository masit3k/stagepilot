import {
  type LineupMap,
  type LineupSlotValue,
  normalizeLineupValue,
  normalizeLineupSlots,
  getRoleSlotLimit,
} from "../../projectRules";

export function serializeLineupForProject(
  lineup: LineupMap,
  roleOrder: string[],
): LineupMap {
  const serialized: LineupMap = {};

  for (const role of roleOrder) {
    const roleSlotLimit = getRoleSlotLimit(role);
    const slots = normalizeLineupSlots(lineup[role], roleSlotLimit);
    const hasOverrides = slots.some((slot) => Boolean(slot.presetOverride) || Boolean(slot.drumDefinition));

    if (hasOverrides) {
      const entry: LineupSlotValue[] = slots.map((slot) => ({
        musicianId: slot.musicianId,
        ...(slot.presetOverride ? { presetOverride: slot.presetOverride } : {}),
        ...(slot.drumDefinition ? { drumDefinition: slot.drumDefinition } : {}),
      }));
      if (entry.length === 0) continue;
      serialized[role] = roleSlotLimit <= 1 ? entry[0] : entry;
      continue;
    }

    const ids = normalizeLineupValue(lineup[role], roleSlotLimit);
    if (ids.length === 0) continue;
    serialized[role] = roleSlotLimit <= 1 ? ids[0] : ids;
  }

  if (lineup.back_vocs !== undefined) {
    serialized.back_vocs = lineup.back_vocs;
  }

  return serialized;
}
