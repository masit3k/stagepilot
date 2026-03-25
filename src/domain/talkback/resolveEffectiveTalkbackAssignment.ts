import type { Project } from "../model/types.js";
import {
  collectActiveLineupMusicianIds,
  resolveProjectTalkbackState,
} from "../project/resolveProjectAudioAssignments.js";

export type EffectiveTalkbackAssignment = {
  mode: "none" | "assigned";
  musicianId?: string;
  hasExplicitOverride: boolean;
};

export function resolveEffectiveTalkbackAssignment(args: {
  project: Project;
  selectedMusicianIds?: string[];
}): EffectiveTalkbackAssignment {
  const selectedMusicianIds =
    args.selectedMusicianIds ?? collectActiveLineupMusicianIds(args.project);

  const resolved = resolveProjectTalkbackState({
    project: args.project,
    activeMusicianIds: selectedMusicianIds,
  });

  if (!resolved.effectiveTalkbackOwnerId) {
    return {
      mode: "none",
      hasExplicitOverride: resolved.hasExplicitTalkbackOverride,
    };
  }

  return {
    mode: "assigned",
    musicianId: resolved.effectiveTalkbackOwnerId,
    hasExplicitOverride: resolved.hasExplicitTalkbackOverride,
  };
}
