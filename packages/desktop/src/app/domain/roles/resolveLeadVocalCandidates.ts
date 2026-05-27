import type { Group } from "../../../../../../src/domain/model/groups";
import type { VocalCandidateReason, VocalCandidateSection } from "./resolveLineupVocalCandidates";

export type LeadVocalCandidateInput = {
  musicianId: string;
  displayName: string;
  primaryGroup: Group;
  section: VocalCandidateSection;
  reason: VocalCandidateReason;
};

export type LeadVocalCandidate = {
  musicianId: string;
  displayName: string;
  primaryGroup: Group;
  isSuggested: boolean;
  isSelected: boolean;
  hasLeadPreset: boolean;
  reason: VocalCandidateReason;
};

export type LeadVocalCandidateSections = {
  suggestedLeadVocalCandidates: LeadVocalCandidate[];
  otherLeadVocalCandidates: LeadVocalCandidate[];
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

function compareCandidates(
  left: LeadVocalCandidate,
  right: LeadVocalCandidate,
): number {
  if (left.isSelected !== right.isSelected) return left.isSelected ? -1 : 1;
  if (left.isSuggested !== right.isSuggested) return left.isSuggested ? -1 : 1;

  const groupDiff =
    groupRank(left.primaryGroup) - groupRank(right.primaryGroup);
  if (groupDiff !== 0) return groupDiff;

  const nameDiff = left.displayName.localeCompare(right.displayName, "en");
  if (nameDiff !== 0) return nameDiff;

  return left.musicianId.localeCompare(right.musicianId, "en");
}

export function resolveLeadVocalCandidates(args: {
  lineupCandidates: LeadVocalCandidateInput[];
  selectedLeadVocalistIds: string[];
}): LeadVocalCandidateSections {
  const selectedSet = new Set(args.selectedLeadVocalistIds);

  const candidates = args.lineupCandidates.map((candidate) => {
    const isSelected = selectedSet.has(candidate.musicianId);
    const isSuggested = candidate.section === "suggested";
    return {
      musicianId: candidate.musicianId,
      displayName: candidate.displayName,
      primaryGroup: candidate.primaryGroup,
      isSuggested,
      isSelected,
      hasLeadPreset: candidate.reason === "lead_vocal_capability",
      reason: candidate.reason,
    } satisfies LeadVocalCandidate;
  });

  const suggestedLeadVocalCandidates = candidates
    .filter((candidate) => candidate.isSuggested)
    .sort(compareCandidates);
  const otherLeadVocalCandidates = candidates
    .filter((candidate) => !candidate.isSuggested)
    .sort(compareCandidates);

  return {
    suggestedLeadVocalCandidates,
    otherLeadVocalCandidates,
  };
}
