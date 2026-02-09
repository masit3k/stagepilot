import type {
  Band,
  Musician,
  StageplanInstrumentKey,
  StageplanPerson,
} from "../model/types.js";
import type { LineupValue } from "../model/types.js";

function firstMemberId(value: LineupValue | undefined): string | null {
  if (!value) return null;
  const ids = Array.isArray(value) ? value : [value];
  return ids[0] ?? null;
}

export function resolveStageplanPerson(
  band: Band,
  role: StageplanInstrumentKey,
  membersById: Map<string, Musician>
): StageplanPerson {
  const memberId = firstMemberId(band.defaultLineup?.[role]);
  const member = memberId ? membersById.get(memberId) : undefined;
  return {
    firstName: member?.firstName ?? null,
    isBandLeader: Boolean(memberId && memberId === band.bandLeader),
  };
}
