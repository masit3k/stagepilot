import type { Musician, PresetEntity } from "../../../../../../../src/domain/model/types";

export type MusicianId = Musician["id"];

export function isBackVocalPresetRef(ref: string): boolean {
  return ref.startsWith("vocal_back_");
}

export function getBackVocsFromTemplate(musicians: Musician[]): Set<MusicianId> {
  return new Set(
    musicians
      .filter((musician) => musician.presets.some((preset) => preset.kind === "vocal" && isBackVocalPresetRef(preset.ref)))
      .map((musician) => musician.id),
  );
}

export function applyBackVocsSelection(
  musicians: Musician[],
  selectedIds: Set<MusicianId>,
  defaultBackVocalRef: string,
): Musician[] {
  return musicians.map((musician) => {
    const hasBackVocal = musician.presets.some((preset) => preset.kind === "vocal" && isBackVocalPresetRef(preset.ref));
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
      presets: musician.presets.filter((preset) => !(preset.kind === "vocal" && isBackVocalPresetRef(preset.ref))),
    };
  });
}

export function resolveDefaultBackVocalRef(presetsRegistry: PresetEntity[]): string {
  const refs = presetsRegistry
    .filter((item): item is PresetEntity & { id: string } => "id" in item && typeof item.id === "string")
    .map((item) => item.id)
    .filter(isBackVocalPresetRef)
    .sort((a, b) => a.localeCompare(b));

  if (refs.includes("vocal_back_no_mic")) return "vocal_back_no_mic";
  return refs[0] ?? "";
}
