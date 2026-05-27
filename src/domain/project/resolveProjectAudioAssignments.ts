import type { Group, Project } from "../model/types.js";
import { isGroup } from "../model/groups.js";

type ProjectWithLineup = Project & { lineup?: Record<string, unknown> };
type ProjectWithOverlays = Project & {
  overlays?: {
    leadVocals?: unknown;
    backVocals?: unknown;
    talkback?: { mode?: unknown; ownerId?: unknown };
  };
};

function normalizeId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function lineupEntries(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return normalizeId(entry);
        if (entry && typeof entry === "object") {
          return normalizeId((entry as { musicianId?: unknown }).musicianId);
        }
        return undefined;
      })
      .filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value === "string") {
    const single = normalizeId(value);
    return single ? [single] : [];
  }

  if (value && typeof value === "object") {
    const single = normalizeId((value as { musicianId?: unknown }).musicianId);
    return single ? [single] : [];
  }

  return [];
}

function normalizeOverlayIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seenMusicians = new Set<string>();
  for (const entry of value) {
    const musicianId = normalizeId(entry);
    if (!musicianId) continue;
    if (seenMusicians.has(musicianId)) continue;
    seenMusicians.add(musicianId);
    out.push(musicianId);
  }
  return out;
}

export function collectActiveLineupMusicianIds(project: Project): string[] {
  const lineup = (project as ProjectWithLineup).lineup;
  if (!lineup) return [];

  const selected = new Set<string>();
  for (const [role, value] of Object.entries(lineup)) {
    if (!isGroup(role) || role === "talkback") continue;
    for (const musicianId of lineupEntries(value)) {
      selected.add(musicianId);
    }
  }
  return Array.from(selected);
}

export function resolveCanonicalOverlayAssignments(args: {
  project: Project;
  role: "leadVocals" | "backVocals";
  activeMusicianIds?: string[];
}): string[] {
  const overlays = (args.project as ProjectWithOverlays).overlays;
  const lineupSet = new Set(args.activeMusicianIds ?? collectActiveLineupMusicianIds(args.project));
  const raw = normalizeOverlayIds(overlays?.[args.role]);
  return raw.filter((musicianId) => lineupSet.has(musicianId));
}

export function resolveProjectTalkbackState(args: {
  project: Project;
  activeMusicianIds: string[];
}): {
  explicitTalkbackOwnerId: string | undefined;
  effectiveTalkbackOwnerId: string | null;
  hasExplicitTalkbackOverride: boolean;
  isExplicitNone: boolean;
} {
  const selected = new Set(args.activeMusicianIds.map((id) => id.trim()).filter(Boolean));
  const explicitTalkback = (args.project as ProjectWithOverlays).overlays?.talkback;

  if (!explicitTalkback || typeof explicitTalkback !== "object") {
    return {
      explicitTalkbackOwnerId: undefined,
      effectiveTalkbackOwnerId: null,
      hasExplicitTalkbackOverride: false,
      isExplicitNone: false,
    };
  }

  if (explicitTalkback.mode === "none") {
    return {
      explicitTalkbackOwnerId: "",
      effectiveTalkbackOwnerId: null,
      hasExplicitTalkbackOverride: true,
      isExplicitNone: true,
    };
  }

  if (explicitTalkback.mode !== "assigned") {
    return {
      explicitTalkbackOwnerId: undefined,
      effectiveTalkbackOwnerId: null,
      hasExplicitTalkbackOverride: true,
      isExplicitNone: false,
    };
  }

  const ownerId = normalizeId(explicitTalkback.ownerId);
  if (!ownerId || !selected.has(ownerId)) {
    return {
      explicitTalkbackOwnerId: ownerId,
      effectiveTalkbackOwnerId: null,
      hasExplicitTalkbackOverride: true,
      isExplicitNone: false,
    };
  }

  return {
    explicitTalkbackOwnerId: ownerId,
    effectiveTalkbackOwnerId: ownerId,
    hasExplicitTalkbackOverride: true,
    isExplicitNone: false,
  };
}

export function hasOwnBackVocsOverride(project: Project): boolean {
  const overlays = (project as ProjectWithOverlays).overlays;
  return Boolean(overlays && Object.prototype.hasOwnProperty.call(overlays, "backVocals"));
}

export function resolveProjectBackVocsState(args: { project: Project }): {
  explicitBackVocs: string[] | undefined;
  defaultBackVocs: string[];
  effectiveBackVocs: string[];
  hasExplicitBackVocsOverride: boolean;
} {
  const hasExplicitBackVocsOverride = hasOwnBackVocsOverride(args.project);
  const explicitBackVocs = hasExplicitBackVocsOverride
    ? resolveCanonicalOverlayAssignments({ project: args.project, role: "backVocals" })
    : undefined;

  return {
    explicitBackVocs,
    defaultBackVocs: [],
    effectiveBackVocs: explicitBackVocs ?? [],
    hasExplicitBackVocsOverride,
  };
}

export function hasOwnTalkbackOverride(project: Project): boolean {
  const overlays = (project as ProjectWithOverlays).overlays;
  return Boolean(overlays && Object.prototype.hasOwnProperty.call(overlays, "talkback"));
}

export function resolveOwnerGroupByMusicianId(project: Project): Map<string, Group> {
  const lineup = (project as ProjectWithLineup).lineup ?? {};
  const byMusicianId = new Map<string, Group>();

  for (const [group, value] of Object.entries(lineup)) {
    if (!isGroup(group) || group === "talkback") continue;
    for (const musicianId of lineupEntries(value)) {
      if (!byMusicianId.has(musicianId)) byMusicianId.set(musicianId, group);
    }
  }

  return byMusicianId;
}
