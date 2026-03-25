import type {
  LineupSlot,
  OverlaySlot,
  ProjectLineup,
  ProjectOverlays,
  Project,
  ProjectJson,
  StagePlanPurpose,
} from "../../domain/model/types.js";
import { isGroup } from "../../domain/model/groups.js";

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
  return slots.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
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
  return slots.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
}

function dedupeOverlaySlots(slots: OverlaySlot[]): OverlaySlot[] {
  const seenSlots = new Set<number>();
  const seenMusicians = new Set<string>();
  return slots.filter((slot) => {
    if (slot.slot === undefined) return false;
    if (seenSlots.has(slot.slot) || seenMusicians.has(slot.musicianId)) return false;
    seenSlots.add(slot.slot);
    seenMusicians.add(slot.musicianId);
    return true;
  });
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Missing or invalid ${label}.`);
  return value.trim();
}

function assertPurpose(value: unknown): StagePlanPurpose {
  if (value === "event" || value === "generic") return value;
  throw new Error("Missing or invalid purpose.");
}

function normalizeCanonicalOverlays(input: ProjectJson, lineup: ProjectLineup | undefined): ProjectOverlays | undefined {
  if (!("overlays" in input) || !input.overlays || typeof input.overlays !== "object") return undefined;
  const raw = input.overlays as { leadVocals?: unknown; backVocals?: unknown; talkback?: unknown };
  const hasLead = Object.prototype.hasOwnProperty.call(raw, "leadVocals");
  const hasBack = Object.prototype.hasOwnProperty.call(raw, "backVocals");
  const hasTalkback = Object.prototype.hasOwnProperty.call(raw, "talkback");

  const lineupMemberIds = new Set(
    Object.values(lineup ?? {}).flatMap((slots) => (Array.isArray(slots) ? slots.map((slot) => slot.musicianId) : [])),
  );
  const leadVocals = dedupeOverlaySlots(normalizeOverlaySlots(raw.leadVocals))
    .filter((slot) => lineupMemberIds.size === 0 || lineupMemberIds.has(slot.musicianId));
  const backVocals = dedupeOverlaySlots(normalizeOverlaySlots(raw.backVocals))
    .filter((slot) => lineupMemberIds.size === 0 || lineupMemberIds.has(slot.musicianId));

  const talkback = (() => {
    if (!raw.talkback || typeof raw.talkback !== "object") return undefined;
    const mode = (raw.talkback as { mode?: unknown }).mode;
    const ownerId = (raw.talkback as { ownerId?: unknown }).ownerId;
    if (mode === "none") return { mode: "none" as const, ownerId: null };
    if (mode === "assigned" && typeof ownerId === "string" && ownerId.trim().length > 0) {
      return lineupMemberIds.size === 0 || lineupMemberIds.has(ownerId.trim())
        ? { mode: "assigned" as const, ownerId: ownerId.trim() }
        : { mode: "none" as const, ownerId: null };
    }
    return undefined;
  })();

  const normalized: ProjectOverlays = {};
  if (hasLead) normalized.leadVocals = leadVocals;
  if (hasBack) normalized.backVocals = backVocals;
  if (hasTalkback && talkback) normalized.talkback = talkback;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeProject(input: ProjectJson): Project {
  const id = assertString((input as ProjectJson).id, "project id");
  const bandRef = assertString((input as ProjectJson).bandRef, "bandRef");
  const raw = input as ProjectJson & { slug?: unknown; displayName?: unknown };
  const slug = typeof raw.slug === "string" ? raw.slug.trim() || undefined : undefined;
  const displayName = typeof raw.displayName === "string" ? raw.displayName.trim() || undefined : undefined;

  const stageplan = (input as ProjectJson).stageplan;
  const createdAt = "createdAt" in input && typeof input.createdAt === "string" && input.createdAt.trim().length > 0
    ? input.createdAt.trim()
    : undefined;
  const updatedAt = "updatedAt" in input && typeof input.updatedAt === "string" && input.updatedAt.trim().length > 0
    ? input.updatedAt.trim()
    : undefined;
  const lineup = (() => {
    if (!("lineup" in input) || !input.lineup || typeof input.lineup !== "object") return undefined;
    const rawLineup = input.lineup as Record<string, unknown>;
    const normalized: ProjectLineup = {};
    for (const [group, value] of Object.entries(rawLineup)) {
      if (!isGroup(group) || group === "talkback") continue;
      normalized[group as keyof ProjectLineup] = normalizeLineupSlots(value);
    }
    return normalized;
  })();
  const overlays = normalizeCanonicalOverlays(input, lineup);
  const bandLeaderId = "bandLeaderId" in input && typeof input.bandLeaderId === "string" && input.bandLeaderId.trim().length > 0
    ? input.bandLeaderId.trim()
    : undefined;

  if ("purpose" in input) {
    const purpose = assertPurpose(input.purpose);
    const documentDate = assertString(input.documentDate, "documentDate");

    if (purpose === "event") {
      return {
        id,
        bandRef,
        slug,
        displayName,
        purpose,
        eventDate: assertString(input.eventDate, "eventDate"),
        eventVenue: assertString(input.eventVenue, "eventVenue"),
        documentDate,
        note: input.note?.trim() || input.title?.trim() || undefined,
        createdAt,
        updatedAt,
        template: input.template?.trim() || undefined,
        lineup,
        overlays,
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
      bandLeaderId,
      stageplan,
    };
  }

  if ("date" in input) {
    const eventDate = assertString(input.date, "date");
    const eventVenue = typeof input.venue === "string" && input.venue.trim() ? input.venue.trim() : undefined;
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
      bandLeaderId,
      stageplan,
    };
  }

  throw new Error("Unsupported project schema.");
}
