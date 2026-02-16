import { GROUP_ORDER, type Group } from "../model/groups.js";
import type { LineupValue, PresetOverridePatch, Project } from "../model/types.js";

type LegacyLineupEntry = { musicianId?: unknown; presetOverride?: unknown };

type ProjectWithLineup = Project & {
  lineup?: Record<string, unknown>;
  talkbackOwnerId?: unknown;
};

function normalizeLineupEntry(entry: unknown): { musicianId: string; presetOverride?: PresetOverridePatch } | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    return trimmed.length > 0 ? { musicianId: trimmed } : null;
  }

  if (entry && typeof entry === "object") {
    const legacy = entry as LegacyLineupEntry;
    if (typeof legacy.musicianId === "string" && legacy.musicianId.trim().length > 0) {
      return {
        musicianId: legacy.musicianId.trim(),
        ...(legacy.presetOverride && typeof legacy.presetOverride === "object"
          ? { presetOverride: legacy.presetOverride as PresetOverridePatch }
          : {}),
      };
    }
  }

  return null;
}

function normalizeLineupSlots(v: unknown): Array<{ musicianId: string; presetOverride?: PresetOverridePatch }> {
  if (Array.isArray(v)) {
    return v
      .map((entry) => normalizeLineupEntry(entry))
      .filter((entry): entry is { musicianId: string; presetOverride?: PresetOverridePatch } => Boolean(entry));
  }

  const single = normalizeLineupEntry(v);
  return single ? [single] : [];
}

function firstRoleValue(lineup: Record<string, unknown>, role: Group): unknown {
  if (role === "vocs") {
    return lineup.lead_vocs ?? lineup.vocs;
  }
  return lineup[role];
}

export function resolveEffectiveProjectState(args: {
  project: Project;
  bandDefaultLineup: Partial<Record<Group, LineupValue>>;
  bandLeaderId: string;
}): {
  effectiveLineup: Record<Group, string[]>;
  presetOverrideByMusicianId: Map<string, PresetOverridePatch>;
  effectiveTalkbackOwnerId: string;
} {
  const projectLineup = ((args.project as ProjectWithLineup).lineup ?? {}) as Record<string, unknown>;
  const effectiveLineup = {} as Record<Group, string[]>;
  const presetOverrideByMusicianId = new Map<string, PresetOverridePatch>();

  for (const group of GROUP_ORDER) {
    const projectSlots = normalizeLineupSlots(firstRoleValue(projectLineup, group));
    const fallbackSlots = normalizeLineupSlots(args.bandDefaultLineup[group]);
    const resolvedSlots = projectSlots.length > 0 ? projectSlots : fallbackSlots;
    effectiveLineup[group] = resolvedSlots.map((slot) => slot.musicianId);

    for (const slot of resolvedSlots) {
      if (slot.presetOverride) {
        presetOverrideByMusicianId.set(slot.musicianId, slot.presetOverride);
      }
    }
  }

  const rawTalkbackOwnerId = (args.project as ProjectWithLineup).talkbackOwnerId;
  const effectiveTalkbackOwnerId =
    typeof rawTalkbackOwnerId === "string" && rawTalkbackOwnerId.trim().length > 0
      ? rawTalkbackOwnerId.trim()
      : args.bandLeaderId;

  return {
    effectiveLineup,
    presetOverrideByMusicianId,
    effectiveTalkbackOwnerId,
  };
}
