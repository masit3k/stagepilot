import type { Musician, PresetEntity } from "../../../../../../../src/domain/model/types";

export type MusicianId = Musician["id"];

const GENERIC_VOCAL_REFS = new Set(["vocal_no_mic", "vocal_wired", "vocal_wireless"]);

function isGenericVocalRef(ref: string): boolean {
  return GENERIC_VOCAL_REFS.has(ref);
}

function isTalkbackRef(ref: string): boolean {
  return ref === "talkback" || ref.startsWith("talkback_");
}

type PresetWithRef = { kind: string; ref: string };

function asPresetWithRef(preset: unknown): PresetWithRef | null {
  if (!preset || typeof preset !== "object") return null;
  if (!("ref" in preset) || !("kind" in preset)) return null;
  const ref = (preset as { ref?: unknown }).ref;
  const kind = (preset as { kind?: unknown }).kind;
  if (typeof ref !== "string" || typeof kind !== "string") return null;
  return { kind, ref };
}

function hasRefMatching(preset: Musician["presets"][number], predicate: (ref: string) => boolean): boolean {
  const withRef = asPresetWithRef(preset);
  if (!withRef) return false;
  return (withRef.kind === "preset" || withRef.kind === "talkback") && predicate(withRef.ref);
}

export function isBackVocalRef(ref: string): boolean {
  return isGenericVocalRef(ref);
}

export function isBackVocalPreset(preset: PresetWithRef): boolean {
  return preset.kind === "preset" && isBackVocalRef(preset.ref);
}

export function getBackVocsFromTemplate(musicians: Musician[]): Set<MusicianId> {
  return new Set(
    musicians
      .filter((musician) => musician.presets.some((preset) => hasRefMatching(preset, isGenericVocalRef)))
      .map((musician) => musician.id),
  );
}

export function getLeadVocsFromTemplate(musicians: Musician[]): Set<MusicianId> {
  return new Set(
    musicians
      .filter((musician) => musician.presets.some((preset) => hasRefMatching(preset, isGenericVocalRef)))
      .map((musician) => musician.id),
  );
}

export function getTalkbackOwnersFromTemplate(musicians: Musician[]): Set<MusicianId> {
  return new Set(
    musicians
      .filter((musician) =>
        musician.presets.some((preset) => {
          const withRef = asPresetWithRef(preset);
          if (!withRef) return false;
          return withRef.kind === "talkback" || (withRef.kind === "preset" && isTalkbackRef(withRef.ref));
        }),
      )
      .map((musician) => musician.id),
  );
}

export function getBackVocalCandidatesFromTemplate(musicians: Musician[]): Musician[] {
  const leadVocIds = getLeadVocsFromTemplate(musicians);
  return musicians.filter((musician) => !leadVocIds.has(musician.id));
}

export function filterBackVocalCandidates(args: {
  lineupCandidates: Array<{ id: string }>;
  selectedLeadVocalistIds: Iterable<string>;
}): string[] {
  const leadIds = new Set(args.selectedLeadVocalistIds);
  return args.lineupCandidates
    .map((candidate) => candidate.id)
    .filter((id) => !leadIds.has(id));
}

export function sanitizeBackVocsSelection(selectedIds: Set<MusicianId>, leadVocIds: Set<MusicianId>): Set<MusicianId> {
  return new Set(Array.from(selectedIds).filter((id) => !leadVocIds.has(id)));
}

export function applyBackVocsSelection(
  musicians: Musician[],
  selectedIds: Set<MusicianId>,
  defaultBackVocalRef: string,
): Musician[] {
  if (!isGenericVocalRef(defaultBackVocalRef)) {
    return musicians;
  }

  return musicians.map((musician) => {
    const hasVocalCapability = musician.presets.some((preset) => hasRefMatching(preset, isGenericVocalRef));
    const shouldBeSelected = selectedIds.has(musician.id);

    if (shouldBeSelected && hasVocalCapability) return musician;
    if (!shouldBeSelected && !hasVocalCapability) return musician;

    if (shouldBeSelected) {
      return {
        ...musician,
        presets: [
          ...musician.presets,
          { kind: "preset", ref: defaultBackVocalRef },
        ],
      };
    }

    return {
      ...musician,
      presets: musician.presets.filter((preset) => !hasRefMatching(preset, isGenericVocalRef)),
    };
  });
}

export function detectBackVocalPresetKind(_musicians: Musician[]): "preset" {
  return "preset";
}

export function resolveDefaultBackVocalRef(presetsRegistry: PresetEntity[]): string {
  const refs = presetsRegistry
    .filter((item): item is PresetEntity & { id: string } => "id" in item && typeof item.id === "string")
    .map((item) => item.id)
    .filter(isGenericVocalRef)
    .sort((a, b) => a.localeCompare(b));

  if (refs.includes("vocal_no_mic")) return "vocal_no_mic";
  return refs[0] ?? "";
}
