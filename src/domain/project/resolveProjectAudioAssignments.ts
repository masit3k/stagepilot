import type { Project } from "../model/types.js";
import { isGroup } from "../model/groups.js";

type ProjectWithLineup = Project & { lineup?: Record<string, unknown> };
type ProjectWithOverlays = Project & { overlays?: { backVocals?: Array<{ musicianId?: unknown }>; talkback?: { mode?: unknown; ownerId?: unknown } } };

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
        if (entry && typeof entry === "object")
          return normalizeId((entry as { musicianId?: unknown }).musicianId);
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

export function hasOwnBackVocsOverride(project: Project): boolean {
  const overlays = (project as ProjectWithOverlays).overlays;
  return Boolean(overlays && Object.prototype.hasOwnProperty.call(overlays, "backVocals"));
}

export function resolveProjectBackVocsState(args: {
  project: Project;
}): {
  explicitBackVocs: string[] | undefined;
  defaultBackVocs: string[];
  effectiveBackVocs: string[];
  hasExplicitBackVocsOverride: boolean;
} {
  const overlays = ((args.project as ProjectWithOverlays).overlays ?? {}) as Record<string, unknown>;
  const hasExplicitBackVocsOverride = Object.prototype.hasOwnProperty.call(overlays, "backVocals");
  const explicitBackVocs = hasExplicitBackVocsOverride
    ? lineupEntries(overlays.backVocals)
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

function firstAllowed(
  allowed: string[] | undefined,
  preferred: string,
): string | null {
  if (!preferred) return allowed?.[0] ?? null;
  if (!allowed || allowed.length === 0) return preferred;
  return allowed.includes(preferred) ? preferred : (allowed[0] ?? null);
}

export function resolveProjectTalkbackState(args: {
  project: Project;
  activeMusicianIds: string[];
  defaultTalkbackOwnerId: string;
}): {
  explicitTalkbackOwnerId: string | undefined;
  defaultTalkbackOwnerId: string | null;
  effectiveTalkbackOwnerId: string | null;
  hasExplicitTalkbackOverride: boolean;
  isExplicitNone: boolean;
} {
  const selected = args.activeMusicianIds.filter((id) => id.trim().length > 0);
  const fallback = firstAllowed(
    selected.length > 0 ? selected : undefined,
    args.defaultTalkbackOwnerId.trim(),
  );

  const explicitTalkback = (args.project as ProjectWithOverlays).overlays?.talkback;
  if (explicitTalkback?.mode === "none") {
    return {
      explicitTalkbackOwnerId: "",
      defaultTalkbackOwnerId: fallback,
      effectiveTalkbackOwnerId: fallback,
      hasExplicitTalkbackOverride: true,
      isExplicitNone: true,
    };
  }
  if (explicitTalkback?.mode === "assigned" && typeof explicitTalkback.ownerId === "string") {
    const trimmed = explicitTalkback.ownerId.trim();
    if (trimmed.length === 0) {
      return {
        explicitTalkbackOwnerId: "",
        defaultTalkbackOwnerId: fallback,
        effectiveTalkbackOwnerId: fallback,
        hasExplicitTalkbackOverride: true,
        isExplicitNone: true,
      };
    }
    if (selected.length > 0 && !selected.includes(trimmed)) {
      return {
        explicitTalkbackOwnerId: trimmed,
        defaultTalkbackOwnerId: fallback,
        effectiveTalkbackOwnerId: fallback,
        hasExplicitTalkbackOverride: true,
        isExplicitNone: false,
      };
    }
    return {
      explicitTalkbackOwnerId: trimmed,
      defaultTalkbackOwnerId: fallback,
      effectiveTalkbackOwnerId: trimmed,
      hasExplicitTalkbackOverride: true,
      isExplicitNone: false,
    };
  }
  return {
    explicitTalkbackOwnerId: undefined,
    defaultTalkbackOwnerId: fallback,
    effectiveTalkbackOwnerId: fallback,
    hasExplicitTalkbackOverride: false,
    isExplicitNone: false,
  };
}
