import type {
  Musician,
  StageplanInstrumentKey,
  StageplanPerson,
} from "../model/types.js";
import type { Group } from "../model/groups.js";

export function resolveStageplanPerson(
  role: StageplanInstrumentKey,
  lineup: Record<Group, string[]>,
  bandLeaderId: string,
  membersById: Map<string, Musician>
): StageplanPerson {
  const memberId = lineup[role]?.[0] ?? null;
  const member = memberId ? membersById.get(memberId) : undefined;
  return {
    firstName: member?.firstName ?? null,
    isBandLeader: Boolean(memberId && memberId === bandLeaderId),
  };
}
