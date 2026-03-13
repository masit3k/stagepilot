import type { Project } from "../model/types.js";

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
  if (value.mode === "assigned" && typeof value.musicianId === "string" && value.musicianId.trim().length > 0) {
    return { mode: "assigned", musicianId: value.musicianId.trim() };
  }
  return undefined;
}

function firstAllowed(allowed: string[] | undefined, preferred: string): string | undefined {
  if (allowed && allowed.length > 0 && !allowed.includes(preferred)) {
    return allowed[0];
  }
  return preferred || allowed?.[0];
}

export function resolveEffectiveTalkbackAssignment(args: {
  project: Project;
  bandLeaderId: string;
  selectedMusicianIds?: string[];
}): EffectiveTalkbackAssignment {
  const projectWithTalkback = args.project as ProjectWithTalkback;
  const selected = (args.selectedMusicianIds ?? []).filter((id) => id.trim().length > 0);

  const fallbackMusicianId = firstAllowed(selected.length > 0 ? selected : undefined, args.bandLeaderId.trim());

  const explicitOverride = normalizeOverride(projectWithTalkback.talkbackOverride);
  if (explicitOverride?.mode === "none") {
    return { mode: "none", hasExplicitOverride: true };
  }
  if (explicitOverride?.mode === "assigned") {
    const musicianId = firstAllowed(selected.length > 0 ? selected : undefined, explicitOverride.musicianId);
    return musicianId
      ? { mode: "assigned", musicianId, hasExplicitOverride: true }
      : { mode: "none", hasExplicitOverride: true };
  }

  if (Object.prototype.hasOwnProperty.call(projectWithTalkback, "talkbackOwnerId")) {
    const rawLegacyOwnerId = projectWithTalkback.talkbackOwnerId;
    if (typeof rawLegacyOwnerId === "string") {
      const trimmedOwnerId = rawLegacyOwnerId.trim();
      if (trimmedOwnerId.length === 0) return { mode: "none", hasExplicitOverride: true };
      const musicianId = firstAllowed(selected.length > 0 ? selected : undefined, trimmedOwnerId);
      return musicianId
        ? { mode: "assigned", musicianId, hasExplicitOverride: true }
        : { mode: "none", hasExplicitOverride: true };
    }
  }

  return fallbackMusicianId
    ? { mode: "assigned", musicianId: fallbackMusicianId, hasExplicitOverride: false }
    : { mode: "none", hasExplicitOverride: false };
}
