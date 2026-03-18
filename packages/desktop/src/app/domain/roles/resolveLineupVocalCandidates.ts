import type { Group, Musician } from "../../../../../../src/domain/model/types";
import type { MemberOption } from "../../shell/types";
import { getLeadVocsFromTemplate } from "../../components/roles/utils/backVocs";

export type LineupVocalCandidate = {
  id: string;
  name: string;
  primaryGroup: Group;
  hasLeadVocalPreset: boolean;
};

export function resolveLineupVocalCandidates(args: {
  lineupMusicians: Musician[];
  lineupMembers: MemberOption[];
}): LineupVocalCandidate[] {
  const memberNameById = new Map(args.lineupMembers.map((member) => [member.id, member.name]));
  const leadCapability = getLeadVocsFromTemplate(args.lineupMusicians);

  return args.lineupMusicians
    .map((musician) => {
      const name = memberNameById.get(musician.id);
      if (!name) return null;
      return {
        id: musician.id,
        name,
        primaryGroup: musician.group,
        hasLeadVocalPreset: leadCapability.has(musician.id),
      } satisfies LineupVocalCandidate;
    })
    .filter((candidate): candidate is LineupVocalCandidate => Boolean(candidate));
}
