import type { Group, Musician } from "../../../../../../src/domain/model/types";
import type { MemberOption } from "../../shell/types";
import {
  getBackVocsFromTemplate,
  getLeadVocsFromTemplate,
} from "../../components/roles/utils/backVocs";

export type LineupVocalCandidate = {
  id: string;
  name: string;
  primaryGroup: Group;
  hasLeadVocalPreset: boolean;
  hasBackVocalPreset: boolean;
};

const GROUP_ORDER: Group[] = ["drums", "bass", "guitar", "keys", "vocs", "talkback"];

function groupRank(group: Group): number {
  const index = GROUP_ORDER.indexOf(group);
  return index >= 0 ? index : GROUP_ORDER.length;
}

export function resolveLineupVocalCandidates(args: {
  lineupMusicians: Musician[];
  lineupMembers: MemberOption[];
}): LineupVocalCandidate[] {
  const memberNameById = new Map(
    args.lineupMembers.map((member) => [member.id, member.name]),
  );
  const leadCapability = getLeadVocsFromTemplate(args.lineupMusicians);
  const backCapability = getBackVocsFromTemplate(args.lineupMusicians);

  return args.lineupMusicians
    .map((musician) => {
      const name = memberNameById.get(musician.id);
      if (!name) return null;
      return {
        id: musician.id,
        name,
        primaryGroup: musician.group,
        hasLeadVocalPreset: leadCapability.has(musician.id),
        hasBackVocalPreset: backCapability.has(musician.id),
      } satisfies LineupVocalCandidate;
    })
    .filter((candidate): candidate is LineupVocalCandidate => Boolean(candidate))
    .sort((left, right) => {
      const groupDiff = groupRank(left.primaryGroup) - groupRank(right.primaryGroup);
      if (groupDiff !== 0) return groupDiff;
      const nameDiff = left.name.localeCompare(right.name, "en");
      if (nameDiff !== 0) return nameDiff;
      return left.id.localeCompare(right.id, "en");
    });
}
