import type {
  LineupSlot,
  OverlaySlot,
  ProjectLineup,
  ProjectOverlays,
  Project,
  ProjectJson,
  StagePlanPurpose,
} from "../../domain/model/types.js";

function normalizeLegacyLineupIds(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        const musicianId = (entry as { musicianId?: unknown }).musicianId;
        if (typeof musicianId === "string") return musicianId.trim();
      }
      return "";
    })
    .filter((idValue) => idValue.length > 0);
}

function normalizeLineupSlots(value: unknown): LineupSlot[] {
  const entries = Array.isArray(value) ? value : [value];
  const slots: LineupSlot[] = [];
  for (const entry of entries) {
    if (typeof entry === "string" && entry.trim().length > 0) {
      slots.push({ slot: slots.length + 1, musicianId: entry.trim() });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as { slot?: unknown; musicianId?: unknown; presetOverride?: unknown; drumDefinition?: unknown };
    if (typeof raw.musicianId !== "string" || raw.musicianId.trim().length === 0) continue;
    const slotNumber = typeof raw.slot === "number" && Number.isFinite(raw.slot) && raw.slot > 0
      ? Math.floor(raw.slot)
      : slots.length + 1;
    slots.push({
      slot: slotNumber,
      musicianId: raw.musicianId.trim(),
      ...(raw.presetOverride && typeof raw.presetOverride === "object" ? { presetOverride: raw.presetOverride } : {}),
      ...(raw.drumDefinition && typeof raw.drumDefinition === "object" ? { drumDefinition: raw.drumDefinition as LineupSlot["drumDefinition"] } : {}),
    });
  }
  return slots.sort((a, b) => a.slot - b.slot);
}

function normalizeOverlaySlots(value: unknown): OverlaySlot[] {
  if (!Array.isArray(value)) return [];
  const slots: OverlaySlot[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as { slot?: unknown; musicianId?: unknown };
    if (typeof raw.musicianId !== "string" || raw.musicianId.trim().length === 0) continue;
    const slotNumber = typeof raw.slot === "number" && Number.isFinite(raw.slot) && raw.slot > 0
      ? Math.floor(raw.slot)
      : slots.length + 1;
    slots.push({ slot: slotNumber, musicianId: raw.musicianId.trim() });
  }
  return slots.sort((a, b) => a.slot - b.slot);
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing or invalid ${label}.`);
  }
  return value.trim();
}

function assertPurpose(value: unknown): StagePlanPurpose {
  if (value === "event" || value === "generic") return value;
  throw new Error(`Missing or invalid purpose.`);
}

export function normalizeProject(input: ProjectJson): Project {
  const id = assertString((input as ProjectJson).id, "project id");
  const bandRef = assertString((input as ProjectJson).bandRef, "bandRef");
  const raw = input as ProjectJson & { slug?: unknown; displayName?: unknown };
  const slug =
    typeof raw.slug === "string" ? raw.slug.trim() || undefined : undefined;
  const displayName =
    typeof raw.displayName === "string"
      ? raw.displayName.trim() || undefined
      : undefined;
  const stageplan = (input as ProjectJson).stageplan;
  const createdAt =
    "createdAt" in input &&
    typeof input.createdAt === "string" &&
    input.createdAt.trim().length > 0
      ? input.createdAt.trim()
      : undefined;
  const updatedAt =
    "updatedAt" in input &&
    typeof input.updatedAt === "string" &&
    input.updatedAt.trim().length > 0
      ? input.updatedAt.trim()
      : undefined;
  const lineup = (() => {
    if (!("lineup" in input) || !input.lineup || typeof input.lineup !== "object") return undefined;
    const raw = input.lineup as Record<string, unknown>;
    const normalized: ProjectLineup = {};
    for (const [group, value] of Object.entries(raw)) {
      if (group === "lead_vocs" || group === "back_vocs") continue;
      const normalizedSlots = normalizeLineupSlots(value);
      if (normalizedSlots.length > 0) normalized[group as keyof ProjectLineup] = normalizedSlots;
    }
    return normalized;
  })();
  const bandLeaderId =
    "bandLeaderId" in input &&
    typeof input.bandLeaderId === "string" &&
    input.bandLeaderId.trim().length > 0
      ? input.bandLeaderId.trim()
      : undefined;
  const talkbackOwnerId =
    "talkbackOwnerId" in input && typeof input.talkbackOwnerId === "string"
      ? input.talkbackOwnerId.trim()
      : undefined;
  const talkbackOverride =
    "talkbackOverride" in input &&
    input.talkbackOverride &&
    typeof input.talkbackOverride === "object"
      ? ((value) => {
          if (value.mode === "none") return { mode: "none" as const };
          if (
            value.mode === "assigned" &&
            typeof value.musicianId === "string" &&
            value.musicianId.trim().length > 0
          ) {
            return {
              mode: "assigned" as const,
              musicianId: value.musicianId.trim(),
            };
          }
          return undefined;
        })(input.talkbackOverride as { mode?: unknown; musicianId?: unknown })
      : undefined;
  const backVocalIds =
    "backVocalIds" in input && Array.isArray(input.backVocalIds)
      ? input.backVocalIds.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : undefined;
  const leadVocalistIds = (() => {
    if ("leadVocalistIds" in input && Array.isArray(input.leadVocalistIds)) {
      return input.leadVocalistIds.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      );
    }
    const legacyLeadVocs = (input as { lineup?: Record<string, unknown> }).lineup?.lead_vocs;
    if (legacyLeadVocs === undefined) return undefined;
    return normalizeLegacyLineupIds(legacyLeadVocs);
  })();
  const overlays = (() => {
    const explicit =
      "overlays" in input && input.overlays && typeof input.overlays === "object"
        ? (input.overlays as { leadVocals?: unknown; backVocals?: unknown; talkback?: unknown })
        : undefined;
    const leadVocals = explicit?.leadVocals
      ? normalizeOverlaySlots(explicit.leadVocals)
      : (leadVocalistIds ?? []).map((musicianId, index) => ({ slot: index + 1, musicianId }));
    const backVocals = explicit?.backVocals
      ? normalizeOverlaySlots(explicit.backVocals)
      : (backVocalIds ?? []).map((musicianId, index) => ({ slot: index + 1, musicianId }));
    const talkback = (() => {
      const explicitTalkback = explicit?.talkback;
      if (explicitTalkback && typeof explicitTalkback === "object") {
        const mode = (explicitTalkback as { mode?: unknown }).mode;
        const ownerId = (explicitTalkback as { ownerId?: unknown }).ownerId;
        if (mode === "none") return { mode: "none" as const, ownerId: null };
        if (mode === "assigned" && typeof ownerId === "string" && ownerId.trim().length > 0) {
          return { mode: "assigned" as const, ownerId: ownerId.trim() };
        }
      }
      if (talkbackOverride?.mode === "none") return { mode: "none" as const, ownerId: null };
      if (talkbackOverride?.mode === "assigned") return { mode: "assigned" as const, ownerId: talkbackOverride.musicianId };
      if (typeof talkbackOwnerId === "string") {
        if (talkbackOwnerId.trim().length === 0) return { mode: "none" as const, ownerId: null };
        return { mode: "assigned" as const, ownerId: talkbackOwnerId.trim() };
      }
      return undefined;
    })();
    const normalized: ProjectOverlays = {};
    if (leadVocals.length > 0 || Array.isArray(leadVocalistIds)) normalized.leadVocals = leadVocals;
    if (backVocals.length > 0 || Array.isArray(backVocalIds)) normalized.backVocals = backVocals;
    if (talkback) normalized.talkback = talkback;
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  })();

  if ("purpose" in input) {
    const purpose = assertPurpose(input.purpose);
    const documentDate = assertString(input.documentDate, "documentDate");

    if (purpose === "event") {
      const eventDate = assertString(input.eventDate, "eventDate");
      const eventVenue = assertString(input.eventVenue, "eventVenue");
      return {
        id,
        bandRef,
        slug,
        displayName,
        purpose,
        eventDate,
        eventVenue,
        documentDate,
        note: input.note?.trim() || input.title?.trim() || undefined,
        createdAt,
        updatedAt,
        template: input.template?.trim() || undefined,
        lineup,
        overlays,
        backVocalIds,
        leadVocalistIds,
        bandLeaderId,
        stageplan,
      };
    }

    return {
      id,
      bandRef,
      slug,
      displayName,
      purpose,
      documentDate,
      note: input.note?.trim() || input.title?.trim() || undefined,
      createdAt,
      updatedAt,
      template: input.template?.trim() || undefined,
      lineup,
      overlays,
      backVocalIds,
      leadVocalistIds,
      bandLeaderId,
      stageplan,
    };
  }

  if ("date" in input) {
    const eventDate = assertString(input.date, "date");
    const eventVenue =
      typeof input.venue === "string" && input.venue.trim()
        ? input.venue.trim()
        : undefined;
    return {
      id,
      bandRef,
      slug,
      displayName,
      purpose: "event",
      eventDate,
      eventVenue,
      documentDate: eventDate,
      createdAt,
      updatedAt,
      lineup,
      overlays,
      backVocalIds,
      leadVocalistIds,
      bandLeaderId,
      stageplan,
    };
  }

  throw new Error("Unsupported project schema.");
}
