import {
  type LineupMap,
  normalizeLineupValue,
  normalizeRoleConstraint,
} from "../../projectRules";

export function serializeLineupForProject(
  lineup: LineupMap,
  constraints: Record<string, { min: number; max: number }>,
  roleOrder: string[],
): LineupMap {
  const serialized: LineupMap = {};

  for (const role of roleOrder) {
    const roleConstraint = normalizeRoleConstraint(role, constraints[role]);
    const ids = normalizeLineupValue(lineup[role], roleConstraint.max);
    if (ids.length === 0) continue;
    serialized[role] = roleConstraint.max <= 1 ? ids[0] : ids;
  }

  return serialized;
}
