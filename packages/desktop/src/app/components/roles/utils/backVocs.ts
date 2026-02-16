import type { Musician, PresetEntity } from "../../../../../../../src/domain/model/types";

export type MusicianId = Musician["id"];

export function isBackVocalRef(ref: string): boolean {
  return ref.startsWith("vocal_back_");
}

function isLeadVocalRef(ref: string): boolean {
  return ref.startsWith("vocal_lead_");
}

type PresetWithRef = { kind: string; ref: string };
type BackVocalPresetKind = "vocal" | "vocal_type";

function isPresetWithRef(preset: Musician["presets"][number]): preset is Musician["presets"][number] & PresetWithRef {
  return "ref" in preset && typeof preset.ref === "string";
}

function hasVocalRef(preset: Musician["presets"][number], predicate: (ref: string) => boolean): boolean {
  if (!isPresetWithRef(preset)) return false;
  return (preset.kind === "vocal" || preset.kind === "vocal_type" || preset.kind === "preset") && predicate(preset.ref);
}

export function isBackVocalPreset(preset: PresetWithRef): boolean {
  return (preset.kind === "vocal" || preset.kind === "vocal_type") && isBackVocalRef(preset.ref);
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
  const presetKind = detectBackVocalPresetKind(musicians);

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
          createBackVocalPreset(presetKind, defaultBackVocalRef, musician),
        ],
      };
    }

    return {
      ...musician,
      presets: musician.presets.filter((preset) => !hasVocalRef(preset, isBackVocalRef)),
    };
  });
}

export function detectBackVocalPresetKind(musicians: Musician[]): BackVocalPresetKind {
  const existingKinds = musicians
    .flatMap((musician) => musician.presets)
    .filter(isPresetWithRef)
    .filter((preset) => isBackVocalRef(preset.ref))
    .map((preset) => preset.kind);

  if (existingKinds.includes("vocal_type")) return "vocal_type";
  if (existingKinds.includes("vocal")) return "vocal";
  return "vocal_type";
}

function createBackVocalPreset(kind: BackVocalPresetKind, ref: string, musician: Musician): Musician["presets"][number] {
  if (kind === "vocal_type") {
    return { kind, ref } as Musician["presets"][number];
  }
  return {
    kind,
    ref,
    ownerKey: musician.group,
    ownerLabel: musician.group,
  };
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
