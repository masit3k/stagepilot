import { GROUP_ORDER, type Group } from "../model/groups.js";
import { createDefaultDrumDefinition, parseDrumDefinition, type DrumDefinition } from "../drums/drumDefinition.js";
import type { LineupValue, PresetOverridePatch, Project } from "../model/types.js";
import { resolveEffectiveTalkbackAssignment } from "../talkback/resolveEffectiveTalkbackAssignment.js";

type LegacyLineupEntry = { musicianId?: unknown; presetOverride?: unknown; drumDefinition?: unknown };

type ProjectWithLineup = Project & {
  lineup?: Record<string, unknown>;
};

function normalizeMalformedDrumDefinition(input: unknown): DrumDefinition {
  const fallback = createDefaultDrumDefinition();
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Record<string, unknown>;

  const kickCount = raw.kickCount === 2 ? 2 : 1;
  const snareCount = raw.snareCount === 2 || raw.snareCount === 3 ? raw.snareCount : 1;

  const kicks = Array.from({ length: kickCount }, (_, index) => {
    const value = Array.isArray(raw.kicks) ? raw.kicks[index] : undefined;
    if (!value || typeof value !== "object") return { in: true, out: true };
    const kick = value as Record<string, unknown>;
    return {
      in: typeof kick.in === "boolean" ? kick.in : true,
      out: typeof kick.out === "boolean" ? kick.out : true,
    };
  });

  const snares = Array.from({ length: snareCount }, (_, index) => {
    const value = Array.isArray(raw.snares) ? raw.snares[index] : undefined;
    if (!value || typeof value !== "object") return { top: true, bottom: true };
    const snare = value as Record<string, unknown>;
    return {
      top: typeof snare.top === "boolean" ? snare.top : true,
      bottom: typeof snare.bottom === "boolean" ? snare.bottom : true,
    };
  });

  const candidate: Record<string, unknown> = {
    ...fallback,
    ...raw,
    kickCount,
    snareCount,
    kicks,
    snares,
  };
  return parseDrumDefinition(candidate);
}

function parseLineupDrumDefinition(input: unknown): DrumDefinition {
  try {
    return parseDrumDefinition(input);
  } catch {
    return normalizeMalformedDrumDefinition(input);
  }
}

function normalizeLineupEntry(entry: unknown): { musicianId: string; presetOverride?: PresetOverridePatch; drumDefinition?: DrumDefinition } | null {
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
        ...(legacy.drumDefinition && typeof legacy.drumDefinition === "object"
          ? { drumDefinition: parseLineupDrumDefinition(legacy.drumDefinition) }
          : {}),
      };
    }
  }

  return null;
}

function normalizeLineupSlots(v: unknown): Array<{ musicianId: string; presetOverride?: PresetOverridePatch; drumDefinition?: DrumDefinition }> {
  if (Array.isArray(v)) {
    return v
      .map((entry) => normalizeLineupEntry(entry))
      .filter((entry): entry is { musicianId: string; presetOverride?: PresetOverridePatch; drumDefinition?: DrumDefinition } => Boolean(entry));
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
  drumDefinitionByMusicianId: Map<string, DrumDefinition>;
} {
  const projectLineup = ((args.project as ProjectWithLineup).lineup ?? {}) as Record<string, unknown>;
  const effectiveLineup = {} as Record<Group, string[]>;
  const presetOverrideByMusicianId = new Map<string, PresetOverridePatch>();
  const drumDefinitionByMusicianId = new Map<string, DrumDefinition>();

  for (const group of GROUP_ORDER) {
    const projectSlots = normalizeLineupSlots(firstRoleValue(projectLineup, group));
    const fallbackSlots = normalizeLineupSlots(args.bandDefaultLineup[group]);
    const resolvedSlots = projectSlots.length > 0 ? projectSlots : fallbackSlots;
    effectiveLineup[group] = resolvedSlots.map((slot) => slot.musicianId);

    for (const slot of resolvedSlots) {
      if (slot.presetOverride) {
        presetOverrideByMusicianId.set(slot.musicianId, slot.presetOverride);
      }
      if (slot.drumDefinition) {
        drumDefinitionByMusicianId.set(slot.musicianId, slot.drumDefinition);
      }
    }
  }

  const selectedMusicianIds = GROUP_ORDER.flatMap((group) => effectiveLineup[group] ?? []);
  const talkback = resolveEffectiveTalkbackAssignment({
    project: args.project,
    bandLeaderId: args.bandLeaderId,
    selectedMusicianIds,
  });
  const effectiveTalkbackOwnerId = talkback.mode === "assigned" ? talkback.musicianId ?? "" : "";

  return {
    effectiveLineup,
    presetOverrideByMusicianId,
    effectiveTalkbackOwnerId,
    drumDefinitionByMusicianId,
  };
}
