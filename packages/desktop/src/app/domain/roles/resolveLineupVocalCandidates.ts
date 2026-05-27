import type { Group, Musician, PresetEntity } from "../../../../../../src/domain/model/types";
import type { MemberOption } from "../../shell/types";

export type VocalCandidateSection = "suggested" | "additional";
export type VocalAssignmentRole = "lead" | "back";
export type VocalCandidateReason =
  | "lead_vocal_capability"
  | "back_vocal_capability"
  | "vocal_capability"
  | "active_lineup_without_vocal_preset";

export type LineupVocalCandidate = {
  id: string;
  name: string;
  primaryGroup: Group;
  hasLeadVocalPreset: boolean;
  hasBackVocalPreset: boolean;
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
      const capabilities = resolveMusicianVocalCapabilities(musician, args.presetCatalog);
      const leadReason: VocalCandidateReason = capabilities.hasLeadVocalCapability
        ? "lead_vocal_capability"
        : "active_lineup_without_vocal_preset";
      const backReason: VocalCandidateReason = capabilities.hasBackVocalCapability
        ? "back_vocal_capability"
        : capabilities.hasVocalCapability
          ? "vocal_capability"
          : "active_lineup_without_vocal_preset";
      candidates.push({
        id: musician.id,
        name,
        primaryGroup: musician.group,
        hasLeadVocalPreset: capabilities.hasLeadVocalCapability,
        hasBackVocalPreset: capabilities.hasBackVocalCapability || capabilities.hasVocalCapability,
        hasVocalCapability: capabilities.hasVocalCapability,
        sectionByRole: {
          lead: capabilities.hasLeadVocalCapability ? "suggested" : "additional",
          back:
            capabilities.hasBackVocalCapability || capabilities.hasVocalCapability
              ? "suggested"
              : "additional",
        },
        reasonByRole: {
          lead: leadReason,
          back: backReason,
        } satisfies Record<VocalAssignmentRole, VocalCandidateReason>,
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

function resolveMusicianVocalCapabilities(
  musician: Musician,
  presetCatalog: Record<string, PresetEntity | undefined>,
): {
  hasVocalCapability: boolean;
  hasLeadVocalCapability: boolean;
  hasBackVocalCapability: boolean;
} {
  const capabilities = new Set<string>();
  for (const item of musician.presets) {
    if (item.kind !== "preset") continue;
    const preset = presetCatalog[item.ref];
    if (!preset || preset.type !== "preset") continue;
    for (const capability of preset.capabilities ?? []) {
      capabilities.add(capability);
    }
  }
  return {
    hasVocalCapability: capabilities.has("vocal"),
    hasLeadVocalCapability: capabilities.has("lead_vocal"),
    hasBackVocalCapability: capabilities.has("back_vocal"),
  };
}
