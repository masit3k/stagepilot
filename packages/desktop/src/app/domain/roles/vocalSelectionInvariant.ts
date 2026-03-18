export type VocalSelectionInvariantArgs = {
  lineupCandidateIds: Iterable<string>;
  leadIds: Iterable<string>;
  backIds: Iterable<string>;
};

function toUnique(ids: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(ids).filter((id) => id.trim().length > 0)));
}

export function enforceVocalSelectionInvariant({
  lineupCandidateIds,
  leadIds,
  backIds,
}: VocalSelectionInvariantArgs): { leadIds: string[]; backIds: string[] } {
  const candidateIdSet = new Set(lineupCandidateIds);

  const normalizedLeadIds = toUnique(leadIds).filter((id) => candidateIdSet.has(id));
  const leadIdSet = new Set(normalizedLeadIds);
  const normalizedBackIds = toUnique(backIds)
    .filter((id) => candidateIdSet.has(id))
    .filter((id) => !leadIdSet.has(id));

  return {
    leadIds: normalizedLeadIds.sort((a, b) => a.localeCompare(b)),
    backIds: normalizedBackIds.sort((a, b) => a.localeCompare(b)),
  };
}
