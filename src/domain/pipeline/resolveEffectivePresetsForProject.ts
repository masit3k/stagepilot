import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Group,
  Musician,
  PresetItem,
  Project,
} from "../model/types.js";
import { collectActiveLineupMusicianIds } from "../project/resolveProjectAudioAssignments.js";
import { resolveEffectiveTalkbackAssignment } from "../talkback/resolveEffectiveTalkbackAssignment.js";

function isTalkbackItem(item: PresetItem): boolean {
  return item.kind === "talkback";
}

export function resolveEffectivePresetsForProject(args: {
  project: Project;
  band: Band;
  musician: Musician;
  group: Group;
  repo: DataRepository;
}): PresetItem[] {
  const { project, band, musician, group } = args;
  const basePresets = [...(musician.presets ?? [])].filter(
    (item) => !isTalkbackItem(item),
  );


  const selectedIds = collectActiveLineupMusicianIds(project);
  const talkback = resolveEffectiveTalkbackAssignment({
    project,
    bandLeaderId: band.bandLeader,
    selectedMusicianIds: selectedIds,
  });

  if (talkback.mode !== "assigned" || musician.id !== talkback.musicianId) {
    return basePresets;
  }

  return [
    ...basePresets,
    {
      kind: "talkback",
      ref: "talkback",
      ownerKey: group,
      ownerLabel: group,
    },
  ];
}
