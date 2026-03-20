import {
  type LineupMap,
  type LineupSlotValue,
  normalizeLineupValue,
  normalizeLineupSlots,
  getRoleSlotLimit,
} from "../../projectRules";

export const CANONICAL_LINEUP_ROLE_ORDER = ["drums", "bass", "guitar", "keys", "vocs"] as const;

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
      serialized[role] = entry;
      continue;
    }

    const ids = normalizeLineupValue(lineup[role], roleSlotLimit);
    if (ids.length === 0) continue;
    serialized[role] = ids;
  }

  if (lineup.back_vocs !== undefined) {
    serialized.back_vocs = lineup.back_vocs;
  }

  return serialized;
}
