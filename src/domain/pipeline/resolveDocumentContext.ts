import type { DataRepository } from "../../infra/fs/repo.js";
import { GROUP_ORDER, type Group } from "../model/groups.js";
import type { Band, Musician, Project } from "../model/types.js";
import { validateBandLeader } from "../rules/validateBandLeader.js";

export type DocumentBuildContext = {
  project: Project;
  band: Band;
  lineup: Record<Group, string[]>;
  membersById: Map<string, Musician>;
  lineupMusicians: Array<{ group: Group; musician: Musician }>;
  pickByGroup: (group: Group) => Musician | undefined;
};

type LegacyLineupEntry = { musicianId?: unknown; presetOverride?: unknown };

type ProjectWithLineup = Project & {
  lineup?: Record<string, unknown>;
};

function normalizeLineupEntryAny(entry: unknown): string | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (entry && typeof entry === "object") {
    const legacy = entry as LegacyLineupEntry;
    if (typeof legacy.musicianId === "string") {
      const trimmed = legacy.musicianId.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
}

export function normalizeLineupValueAny(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v
      .map((entry) => normalizeLineupEntryAny(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const single = normalizeLineupEntryAny(v);
  return single ? [single] : [];
}

export function resolveDocumentContext(
  project: Project,
  repo: DataRepository,
): DocumentBuildContext {
  const band = repo.getBand(project.bandRef);
  validateBandLeader(band, repo);

  const projectLineup = (project as ProjectWithLineup).lineup ?? {};
  const defaultLineup = (band.defaultLineup ?? {}) as Record<string, unknown>;

  const lineup = {} as Record<Group, string[]>;
  const membersById = new Map<string, Musician>();
  const lineupMusicians: Array<{ group: Group; musician: Musician }> = [];

  for (const group of GROUP_ORDER) {
    const projectValue = normalizeLineupValueAny(projectLineup[group]);
    lineup[group] =
      projectValue.length > 0
        ? projectValue
        : normalizeLineupValueAny(defaultLineup[group]);

    for (const musicianId of lineup[group]) {
      const musician = repo.getMusician(musicianId);
      membersById.set(musicianId, musician);
      lineupMusicians.push({ group, musician });
    }
  }

  return {
    project,
    band,
    lineup,
    membersById,
    lineupMusicians,
    pickByGroup: (group: Group) =>
      lineupMusicians.find((entry) => entry.group === group)?.musician,
  };
}
