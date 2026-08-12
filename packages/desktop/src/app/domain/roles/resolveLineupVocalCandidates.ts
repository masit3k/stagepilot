import type {
  Group,
  Musician,
  PresetEntity,
} from "../../../../../../src/domain/model/types";
import { resolvePresetIdAlias } from "../../../../../../src/domain/model/presetAliases";
import type { MemberOption } from "../../shell/types";

export type VocalCandidateSource = "project_lineup" | "band_catalog";
export type VocalCandidateSection = "suggested" | "other_lineup_members";
export type VocalAssignmentRole = "lead" | "back";
export type VocalCandidateReason =
  | "vocal_capability"
  | "active_lineup_without_vocal_preset"
  | "catalog_without_vocal_preset";

export type LineupVocalCandidate = {
  id: string;
  name: string;
  primaryGroup: Group;
  source: VocalCandidateSource;
  hasVocalCapability: boolean;
  isInProjectLineup: boolean;
  sectionByRole: Record<VocalAssignmentRole, VocalCandidateSection>;
  reasonByRole: Record<VocalAssignmentRole, VocalCandidateReason>;
};

const GROUP_ORDER: Group[] = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "vocs",
  "talkback",
];

function groupRank(group: Group): number {
  const index = GROUP_ORDER.indexOf(group);
  return index >= 0 ? index : GROUP_ORDER.length;
}

export function resolveLineupVocalCandidates(args: {
  lineupMusicians: Musician[];
  lineupMembers: MemberOption[];
  catalogMusicians?: Musician[];
  catalogMembers?: MemberOption[];
  presetCatalog: Record<string, PresetEntity | undefined>;
}): LineupVocalCandidate[] {
  const memberNameById = new Map<string, string>();
  for (const member of args.catalogMembers ?? []) {
    memberNameById.set(member.id, member.name);
  }
  for (const member of args.lineupMembers) {
    memberNameById.set(member.id, member.name);
  }

  const lineupIdSet = new Set(
    args.lineupMusicians.map((musician) => musician.id),
  );
  const musicianById = new Map<string, Musician>();
  for (const musician of args.catalogMusicians ?? []) {
    musicianById.set(musician.id, musician);
  }
  for (const musician of args.lineupMusicians) {
    musicianById.set(musician.id, musician);
  }

  const candidates: LineupVocalCandidate[] = [];
  for (const musician of musicianById.values()) {
    const name = memberNameById.get(musician.id);
    if (!name) continue;
    const isInProjectLineup = lineupIdSet.has(musician.id);
    const hasVocalCapability = resolveMusicianHasVocalCapability(
      musician,
      args.presetCatalog,
    );
    if (
      !isInProjectLineup &&
      musician.group !== "vocs" &&
      !hasVocalCapability
    ) {
      continue;
    }
    const isLeadSuggested = musician.group === "vocs" && hasVocalCapability;
    const leadSection = isLeadSuggested ? "suggested" : "other_lineup_members";
    const backSection = hasVocalCapability
      ? "suggested"
      : "other_lineup_members";
    const fallbackReason = isInProjectLineup
      ? "active_lineup_without_vocal_preset"
      : "catalog_without_vocal_preset";
    candidates.push({
      id: musician.id,
      name,
      primaryGroup: musician.group,
      source: isInProjectLineup ? "project_lineup" : "band_catalog",
      hasVocalCapability,
      isInProjectLineup,
      sectionByRole: {
        lead: leadSection,
        back: backSection,
      },
      reasonByRole: {
        lead: isLeadSuggested ? "vocal_capability" : fallbackReason,
        back: hasVocalCapability ? "vocal_capability" : fallbackReason,
      },
    });
  }

  return candidates.sort((left, right) => {
    const groupDiff =
      groupRank(left.primaryGroup) - groupRank(right.primaryGroup);
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
    const preset = presetCatalog[resolvePresetIdAlias(item.ref)];
    if (!preset || preset.type !== "preset") continue;
    if (preset.capabilities?.includes("vocal")) return true;
  }
  return false;
}
