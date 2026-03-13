import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Group,
  Musician,
  PresetItem,
  Project,
} from "../model/types.js";
import { resolveEffectiveTalkbackAssignment } from "../talkback/resolveEffectiveTalkbackAssignment.js";

type ProjectWithBackVocalIds = Project & {
  backVocalIds?: unknown;
  lineup?: Record<string, unknown>;
};

function normalizeIdList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : [];
}

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

function extractSelectedIdsFromLineup(lineup: Record<string, unknown> | undefined): string[] {
  if (!lineup) return [];
  const selected = new Set<string>();

  for (const value of Object.values(lineup)) {
    if (typeof value === "string" && value.trim().length > 0) {
      selected.add(value.trim());
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim().length > 0) {
          selected.add(entry.trim());
          continue;
        }
        if (entry && typeof entry === "object" && typeof (entry as { musicianId?: unknown }).musicianId === "string") {
          const musicianId = ((entry as { musicianId: string }).musicianId ?? "").trim();
          if (musicianId) selected.add(musicianId);
        }
      }
      continue;
    }
    if (value && typeof value === "object" && typeof (value as { musicianId?: unknown }).musicianId === "string") {
      const musicianId = ((value as { musicianId: string }).musicianId ?? "").trim();
      if (musicianId) selected.add(musicianId);
    }
  }

  return Array.from(selected);
}

export function resolveEffectivePresetsForProject(args: {
  project: Project;
  band: Band;
  musician: Musician;
  group: Group;
  repo: DataRepository;
}): PresetItem[] {
  const { project, band, musician, group, repo } = args;
  const basePresets = [...(musician.presets ?? [])].filter((item) => !isTalkbackItem(item));

  const rawBackVocalIds = (project as ProjectWithBackVocalIds).backVocalIds;
  const explicitBackVocalIds = normalizeIdList(rawBackVocalIds);
  const lineupBackVocalIds = normalizeIdList(
    (project as ProjectWithBackVocalIds).lineup?.back_vocs,
  );
  const selectedBackVocalIds =
    lineupBackVocalIds.length > 0 ? lineupBackVocalIds : explicitBackVocalIds;

  const selectedIds = new Set(selectedBackVocalIds);
  const withoutBackVocal = basePresets.filter((item) => !isBackVocalItem(item));

  let resolvedPresets = withoutBackVocal;
  if (selectedBackVocalIds.length > 0 && selectedIds.has(musician.id)) {
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
    selectedMusicianIds: extractSelectedIdsFromLineup((project as ProjectWithBackVocalIds).lineup),
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
