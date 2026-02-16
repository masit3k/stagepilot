import type { Musician, PresetEntity } from "../../../../../../../src/domain/model/types";

export type MusicianId = Musician["id"];

export function isBackVocalRef(ref: string): boolean {
  return ref.startsWith("vocal_back_");
}

function isLeadVocalRef(ref: string): boolean {
  return ref.startsWith("vocal_lead_");
}

type VocalPreset = Extract<Musician["presets"][number], { kind: "vocal" | "preset" }>;

function hasVocalRef(preset: Musician["presets"][number], predicate: (ref: string) => boolean): preset is VocalPreset {
  return (preset.kind === "vocal" || preset.kind === "preset") && predicate(preset.ref);
}

export function getBackVocsFromTemplate(musicians: Musician[]): Set<MusicianId> {
  return new Set(
    musicians
      .filter((musician) => musician.presets.some((preset) => hasVocalRef(preset, isBackVocalRef)))
      .map((musician) => musician.id),
  );
}

export function getLeadVocsFromTemplate(musicians: Musician[]): Set<MusicianId> {
  return new Set(
    musicians
      .filter((musician) => musician.presets.some((preset) => hasVocalRef(preset, isLeadVocalRef)))
      .map((musician) => musician.id),
  );
}


export function getBackVocalCandidatesFromTemplate(musicians: Musician[]): Musician[] {
  const leadVocIds = getLeadVocsFromTemplate(musicians);
  return musicians.filter((musician) => !leadVocIds.has(musician.id));
}

export function sanitizeBackVocsSelection(selectedIds: Set<MusicianId>, leadVocIds: Set<MusicianId>): Set<MusicianId> {
  return new Set(Array.from(selectedIds).filter((id) => !leadVocIds.has(id)));
}

export function applyBackVocsSelection(
  musicians: Musician[],
  selectedIds: Set<MusicianId>,
  defaultBackVocalRef: string,
): Musician[] {
  return musicians.map((musician) => {
    const hasBackVocal = musician.presets.some((preset) => hasVocalRef(preset, isBackVocalRef));
    const shouldBeSelected = selectedIds.has(musician.id);

    if (shouldBeSelected && hasBackVocal) return musician;
    if (!shouldBeSelected && !hasBackVocal) return musician;

    if (shouldBeSelected) {
      return {
        ...musician,
        presets: [
          ...musician.presets,
          {
            kind: "vocal",
            ref: defaultBackVocalRef,
            ownerKey: musician.group,
            ownerLabel: musician.group,
          },
        ],
      };
    }

    return {
      ...musician,
      presets: musician.presets.filter((preset) => !hasVocalRef(preset, isBackVocalRef)),
    };
  });
}

export function resolveDefaultBackVocalRef(presetsRegistry: PresetEntity[]): string {
  const refs = presetsRegistry
    .filter((item): item is PresetEntity & { id: string } => "id" in item && typeof item.id === "string")
    .map((item) => item.id)
    .filter(isBackVocalRef)
    .sort((a, b) => a.localeCompare(b));

  if (refs.includes("vocal_back_no_mic")) return "vocal_back_no_mic";
  return refs[0] ?? "";
}
