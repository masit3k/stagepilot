import type { DataRepository } from "../../infra/fs/repo.js";
import { GROUP_ORDER, type Group } from "../model/groups.js";
import type { Band, Musician, PresetOverridePatch, Project } from "../model/types.js";
import { validateBandLeader } from "../rules/validateBandLeader.js";
import { resolveEffectiveProjectState } from "./resolveEffectiveProjectState.js";

export type DocumentBuildContext = {
  project: Project;
  band: Band;
  lineup: Record<Group, string[]>;
  presetOverrideByMusicianId: Map<string, PresetOverridePatch>;
  talkbackOwnerId: string;
  bandLeaderId: string;
  membersById: Map<string, Musician>;
  lineupMusicians: Array<{ group: Group; musician: Musician }>;
  pickByGroup: (group: Group) => Musician | undefined;
};

export function resolveDocumentContext(
  project: Project,
  repo: DataRepository,
): DocumentBuildContext {
  const band = repo.getBand(project.bandRef);
  validateBandLeader(band, repo);
  const rawProjectBandLeader = (project as Project & { bandLeaderId?: unknown }).bandLeaderId;
  const bandLeaderId =
    typeof rawProjectBandLeader === "string" && rawProjectBandLeader.trim().length > 0
      ? rawProjectBandLeader.trim()
      : band.bandLeader;

  const effective = resolveEffectiveProjectState({
    project,
    bandDefaultLineup: band.defaultLineup ?? {},
    bandLeaderId,
  });

  const lineup = {} as Record<Group, string[]>;
  const membersById = new Map<string, Musician>();
  const lineupMusicians: Array<{ group: Group; musician: Musician }> = [];

  for (const group of GROUP_ORDER) {
    lineup[group] = effective.effectiveLineup[group] ?? [];

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
    presetOverrideByMusicianId: effective.presetOverrideByMusicianId,
    talkbackOwnerId: effective.effectiveTalkbackOwnerId,
    bandLeaderId,
    membersById,
    lineupMusicians,
    pickByGroup: (group: Group) =>
      lineupMusicians.find((entry) => entry.group === group)?.musician,
  };
}
