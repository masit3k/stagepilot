export type MusicianId = string;

export function sanitizeBackVocsSelection(
  selectedIds: Set<MusicianId>,
  leadVocIds: Set<MusicianId>,
): Set<MusicianId> {
  return new Set(Array.from(selectedIds).filter((id) => !leadVocIds.has(id)));
}
