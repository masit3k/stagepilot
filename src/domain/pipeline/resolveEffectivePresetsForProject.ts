import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Group,
  Musician,
  PresetItem,
  Project,
} from "../model/types.js";

type ProjectWithBackVocalIds = Project & {
  backVocalIds?: unknown;
};

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
  const { project, musician, group, repo } = args;
  const basePresets = [...(musician.presets ?? [])];

  const rawBackVocalIds = (project as ProjectWithBackVocalIds).backVocalIds;
  const explicitBackVocalIds = Array.isArray(rawBackVocalIds)
    ? rawBackVocalIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      )
    : [];

  if (explicitBackVocalIds.length === 0) {
    return basePresets;
  }

  const selectedIds = new Set(explicitBackVocalIds);
  const withoutBackVocal = basePresets.filter((item) => !isBackVocalItem(item));

  if (!selectedIds.has(musician.id)) {
    return withoutBackVocal;
  }

  if (basePresets.some((item) => isBackVocalItem(item))) {
    return basePresets;
  }

  const backVocalRef = resolveBackVocalRef(basePresets, repo);
  if (!backVocalRef) {
    return basePresets;
  }

  return [
    ...withoutBackVocal,
    {
      kind: "vocal",
      ref: backVocalRef,
      ownerKey: group,
      ownerLabel: group,
    },
  ];
}
