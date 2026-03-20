import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Group,
  Musician,
  PresetItem,
  Project,
} from "../model/types.js";
import {
  collectActiveLineupMusicianIds,
  resolveProjectBackVocsState,
} from "../project/resolveProjectAudioAssignments.js";
import { resolveEffectiveTalkbackAssignment } from "../talkback/resolveEffectiveTalkbackAssignment.js";

function presetRef(item: PresetItem): string | undefined {
  return "ref" in item && typeof item.ref === "string" ? item.ref : undefined;
}

function isBackVocalRef(ref: string): boolean {
  return ref.startsWith("vocal_back_");
}

function isLeadVocalRef(ref: string): boolean {
  return ref.startsWith("vocal_lead");
}

function isBackVocalItem(item: PresetItem): boolean {
  const ref = presetRef(item);
  return typeof ref === "string" && isBackVocalRef(ref);
}

function isLeadVocalItem(item: PresetItem): boolean {
  const ref = presetRef(item);
  return typeof ref === "string" && isLeadVocalRef(ref);
}

function isTalkbackItem(item: PresetItem): boolean {
  return item.kind === "talkback";
}

function resolveBackVocalRef(
  basePresets: PresetItem[],
  repo: DataRepository,
): string {
  const existingRefs = Array.from(
    new Set(
      basePresets
        .map((item) => presetRef(item))
        .filter(
          (ref): ref is string => Boolean(ref) && isBackVocalRef(ref as string),
        ),
    ),
  ).sort((a, b) => a.localeCompare(b));

  if (existingRefs.includes("vocal_back_no_mic")) {
    return "vocal_back_no_mic";
  }

  try {
    const preferred = repo.getPreset("vocal_back_no_mic");
    if (preferred.type === "vocal_type") {
      return preferred.id;
    }
  } catch {
    // Not available in this repository.
  }

  return existingRefs[0] ?? "";
}

function collectLeadOverlayMusicianIds(project: Project, selectedMusicianSet: Set<string>): string[] {
  const overlays = (project as Project & { overlays?: { leadVocals?: Array<{ musicianId?: unknown }> } }).overlays;
  if (!overlays || !Object.prototype.hasOwnProperty.call(overlays, "leadVocals")) return [];
  const rawLeadVocals = Array.isArray(overlays.leadVocals) ? overlays.leadVocals : [];
  const seen = new Set<string>();
  const selectedLeadVocalIds: string[] = [];
  for (const entry of rawLeadVocals) {
    const musicianId = typeof entry?.musicianId === "string" ? entry.musicianId.trim() : "";
    if (!musicianId || seen.has(musicianId) || !selectedMusicianSet.has(musicianId)) continue;
    seen.add(musicianId);
    selectedLeadVocalIds.push(musicianId);
  }
  return selectedLeadVocalIds;
}

function resolveLeadVocalItem(group: Group, repo: DataRepository): PresetItem | undefined {
  for (const ref of ["vocal_lead_no_mic", "vocal_lead"]) {
    try {
      const preset = repo.getPreset(ref);
      if (preset.type === "preset") {
        return { kind: "preset", ref: preset.id };
      }
      if (preset.type === "vocal_type") {
        return {
          kind: "vocal",
          ref: preset.id,
          ownerKey: group,
          ownerLabel: group,
        };
      }
    } catch {
      // Not available in this repository.
    }
  }
  return undefined;
}

function hasLeadVocalCapability(presets: PresetItem[], repo: DataRepository): boolean {
  for (const item of presets) {
    if (isLeadVocalItem(item)) return true;
    if (item.kind !== "preset") continue;
    try {
      const preset = repo.getPreset(item.ref);
      if (
        preset.type === "preset" &&
        preset.inputs.some((input) => typeof input.key === "string" && input.key.startsWith("voc_lead"))
      ) {
        return true;
      }
    } catch {
      // Ignore invalid preset references in capability probing.
    }
  }
  return false;
}

export function resolveEffectivePresetsForProject(args: {
  project: Project;
  band: Band;
  musician: Musician;
  group: Group;
  repo: DataRepository;
}): PresetItem[] {
  const { project, band, musician, group, repo } = args;
  const basePresets = [...(musician.presets ?? [])].filter(
    (item) => !isTalkbackItem(item),
  );

  const selectedIds = collectActiveLineupMusicianIds(project);
  const selectedMusicianSet = new Set(selectedIds);
  const selectedLeadVocalIds = collectLeadOverlayMusicianIds(project, selectedMusicianSet);
  const selectedLeadVocalSet = new Set(selectedLeadVocalIds);
  const backVocsState = resolveProjectBackVocsState({
    project,
  });

  const selectedBackVocalIds = (backVocsState.explicitBackVocs ?? []).filter((id) =>
    selectedMusicianSet.has(id),
  );
  const selectedBackVocalSet = new Set(selectedBackVocalIds);
  const withoutBackVocal = basePresets.filter((item) => !isBackVocalItem(item));

  let resolvedPresets = withoutBackVocal;
  if (
    selectedBackVocalIds.length > 0 &&
    selectedBackVocalSet.has(musician.id)
  ) {
    if (basePresets.some((item) => isBackVocalItem(item))) {
      resolvedPresets = basePresets;
    } else {
      const backVocalRef = resolveBackVocalRef(basePresets, repo);
      if (backVocalRef) {
        resolvedPresets = [
          ...withoutBackVocal,
          {
            kind: "vocal",
            ref: backVocalRef,
            ownerKey: group,
            ownerLabel: group,
          },
        ];
      }
    }
  }
  if (
    selectedLeadVocalIds.length > 0 &&
    selectedLeadVocalSet.has(musician.id) &&
    !hasLeadVocalCapability(resolvedPresets, repo)
  ) {
    const leadVocalItem = resolveLeadVocalItem(group, repo);
    if (leadVocalItem) {
      resolvedPresets = [...resolvedPresets, leadVocalItem];
    }
  }

  const talkback = resolveEffectiveTalkbackAssignment({
    project,
    bandLeaderId: band.bandLeader,
    selectedMusicianIds: selectedIds,
  });

  if (talkback.mode !== "assigned" || musician.id !== talkback.musicianId) {
    return resolvedPresets;
  }

  return [
    ...resolvedPresets,
    {
      kind: "talkback",
      ref: "talkback",
      ownerKey: group,
      ownerLabel: group,
    },
  ];
}
