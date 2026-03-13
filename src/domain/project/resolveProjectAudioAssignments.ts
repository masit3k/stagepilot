import type { Musician, PresetItem, Project } from "../model/types.js";

type ProjectWithLineup = Project & { lineup?: Record<string, unknown> };

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
    if (role === "back_vocs") continue;
    for (const musicianId of lineupEntries(value)) {
      selected.add(musicianId);
    }
  }
  return Array.from(selected);
}

function presetRef(item: PresetItem): string | undefined {
  return "ref" in item && typeof item.ref === "string" ? item.ref : undefined;
}

function hasBackVocalPreset(musician: Musician): boolean {
  return musician.presets.some((item) => {
    const ref = presetRef(item);
    return (
      item.kind === "vocal" &&
      typeof ref === "string" &&
      ref.startsWith("vocal_back_")
    );
  });
}

export function hasOwnBackVocsOverride(project: Project): boolean {
  const lineup = (project as ProjectWithLineup).lineup;
  return Boolean(
    lineup && Object.prototype.hasOwnProperty.call(lineup, "back_vocs"),
  );
}

export function resolveProjectBackVocsState(args: {
  project: Project;
  activeMusicianIds: string[];
  musiciansById: Map<string, Musician>;
}): {
  explicitBackVocs: string[] | undefined;
  defaultBackVocs: string[];
  effectiveBackVocs: string[];
  hasExplicitBackVocsOverride: boolean;
} {
  const lineup = ((args.project as ProjectWithLineup).lineup ?? {}) as Record<
    string,
    unknown
  >;
  const hasExplicitBackVocsOverride = Object.prototype.hasOwnProperty.call(
    lineup,
    "back_vocs",
  );
  const explicitBackVocs = hasExplicitBackVocsOverride
    ? lineupEntries(lineup.back_vocs)
    : undefined;

  const defaultBackVocs = args.activeMusicianIds
    .filter((musicianId) => {
      const musician = args.musiciansById.get(musicianId);
      return musician ? hasBackVocalPreset(musician) : false;
    })
    .filter((musicianId, index, all) => all.indexOf(musicianId) === index);

  return {
    explicitBackVocs,
    defaultBackVocs,
    effectiveBackVocs: explicitBackVocs ?? defaultBackVocs,
    hasExplicitBackVocsOverride,
  };
}

export function hasOwnTalkbackOverride(project: Project): boolean {
  return Object.prototype.hasOwnProperty.call(project, "talkbackOwnerId");
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

  if (Object.prototype.hasOwnProperty.call(args.project, "talkbackOwnerId")) {
    const raw = (args.project as Project & { talkbackOwnerId?: unknown })
      .talkbackOwnerId;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        return {
          explicitTalkbackOwnerId: "",
          defaultTalkbackOwnerId: fallback,
          effectiveTalkbackOwnerId: null,
          hasExplicitTalkbackOverride: true,
          isExplicitNone: true,
        };
      }
      if (selected.length > 0 && !selected.includes(trimmed)) {
        return {
          explicitTalkbackOwnerId: trimmed,
          defaultTalkbackOwnerId: fallback,
          effectiveTalkbackOwnerId: null,
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
  }

  return {
    explicitTalkbackOwnerId: undefined,
    defaultTalkbackOwnerId: fallback,
    effectiveTalkbackOwnerId: fallback,
    hasExplicitTalkbackOverride: false,
    isExplicitNone: false,
  };
}
