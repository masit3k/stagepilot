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

function isBackVocalItem(item: PresetItem): boolean {
  const ref = presetRef(item);
  return typeof ref === "string" && isBackVocalRef(ref);
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
