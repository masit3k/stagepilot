import type { Group, Musician, PresetEntity } from "../../../../../../src/domain/model/types";
import type { MemberOption } from "../../shell/types";

export type VocalCandidateSection = "suggested" | "additional";
export type VocalAssignmentRole = "lead" | "back";
export type VocalCandidateReason =
  | "vocal_capability"
  | "active_lineup_without_vocal_preset";

export type LineupVocalCandidate = {
  id: string;
  name: string;
  primaryGroup: Group;
  hasVocalCapability: boolean;
  sectionByRole: Record<VocalAssignmentRole, VocalCandidateSection>;
  reasonByRole: Record<VocalAssignmentRole, VocalCandidateReason>;
};

const GROUP_ORDER: Group[] = ["drums", "bass", "guitar", "keys", "vocs", "talkback"];

function groupRank(group: Group): number {
  const index = GROUP_ORDER.indexOf(group);
  return index >= 0 ? index : GROUP_ORDER.length;
}

export function resolveLineupVocalCandidates(args: {
  lineupMusicians: Musician[];
  lineupMembers: MemberOption[];
  presetCatalog: Record<string, PresetEntity | undefined>;
}): LineupVocalCandidate[] {
  const memberNameById = new Map(
    args.lineupMembers.map((member) => [member.id, member.name]),
  );

  const candidates: LineupVocalCandidate[] = [];
  for (const musician of args.lineupMusicians) {
    const name = memberNameById.get(musician.id);
    if (!name) continue;
    const hasVocalCapability = resolveMusicianHasVocalCapability(musician, args.presetCatalog);
    const isLeadSuggested = musician.group === "vocs" && hasVocalCapability;
    candidates.push({
      id: musician.id,
      name,
      primaryGroup: musician.group,
      hasVocalCapability,
      sectionByRole: {
        lead: isLeadSuggested ? "suggested" : "additional",
        back: hasVocalCapability ? "suggested" : "additional",
      },
      reasonByRole: {
        lead: isLeadSuggested ? "vocal_capability" : "active_lineup_without_vocal_preset",
        back: hasVocalCapability ? "vocal_capability" : "active_lineup_without_vocal_preset",
      },
    });
  }

  return candidates.sort((left, right) => {
    const groupDiff = groupRank(left.primaryGroup) - groupRank(right.primaryGroup);
    if (groupDiff !== 0) return groupDiff;
    const nameDiff = left.name.localeCompare(right.name, "en");
    if (nameDiff !== 0) return nameDiff;
    return left.id.localeCompare(right.id, "en");
  });
}

function resolveMusicianHasVocalCapability(
  musician: Musician,
  presetCatalog: Record<string, PresetEntity | undefined>,
): boolean {
  for (const item of musician.presets) {
    if (item.kind !== "preset") continue;
    const preset = presetCatalog[item.ref];
    if (!preset || preset.type !== "preset") continue;
    if (preset.capabilities?.includes("vocal")) return true;
  }
  return false;
}
