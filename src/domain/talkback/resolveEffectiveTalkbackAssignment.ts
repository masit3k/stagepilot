import type { Project } from "../model/types.js";
import {
  collectActiveLineupMusicianIds,
  resolveProjectTalkbackState,
} from "../project/resolveProjectAudioAssignments.js";

export type TalkbackOverride =
  | { mode: "none" }
  | { mode: "assigned"; musicianId: string };

export type EffectiveTalkbackAssignment = {
  mode: "none" | "assigned";
  musicianId?: string;
  hasExplicitOverride: boolean;
};

type ProjectWithTalkback = Project & {
  talkbackOverride?: unknown;
  talkbackOwnerId?: unknown;
};

function normalizeOverride(raw: unknown): TalkbackOverride | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as { mode?: unknown; musicianId?: unknown };
  if (value.mode === "none") return { mode: "none" };
  if (
    value.mode === "assigned" &&
    typeof value.musicianId === "string" &&
    value.musicianId.trim().length > 0
  ) {
    return { mode: "assigned", musicianId: value.musicianId.trim() };
  }
  return undefined;
}

export function resolveEffectiveTalkbackAssignment(args: {
  project: Project;
  bandLeaderId: string;
  selectedMusicianIds?: string[];
}): EffectiveTalkbackAssignment {
  const projectWithTalkback = args.project as ProjectWithTalkback;
  const selectedMusicianIds =
    args.selectedMusicianIds ?? collectActiveLineupMusicianIds(args.project);

  if (
    !Object.prototype.hasOwnProperty.call(
      projectWithTalkback,
      "talkbackOwnerId",
    )
  ) {
    const explicitOverride = normalizeOverride(
      projectWithTalkback.talkbackOverride,
    );
    if (explicitOverride?.mode === "none") {
      return { mode: "none", hasExplicitOverride: true };
    }
    if (explicitOverride?.mode === "assigned") {
      const isAllowed =
        selectedMusicianIds.length === 0 ||
        selectedMusicianIds.includes(explicitOverride.musicianId);
      return isAllowed
        ? {
            mode: "assigned",
            musicianId: explicitOverride.musicianId,
            hasExplicitOverride: true,
          }
        : { mode: "none", hasExplicitOverride: true };
    }
  }

  const resolved = resolveProjectTalkbackState({
    project: args.project,
    activeMusicianIds: selectedMusicianIds,
    defaultTalkbackOwnerId: args.bandLeaderId,
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
