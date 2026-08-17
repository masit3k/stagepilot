import { isGroup } from "../../domain/model/groups.js";
import type {
  LineupSlot,
  Project,
  ProjectJson,
  ProjectLineup,
  ProjectNotesOverride,
  ProjectOverlays,
  StagePlanPurpose,
} from "../../domain/model/types.js";
import { normalizeStageplanLayout } from "../../domain/stageplan/layout/normalizeLayout.js";

function normalizeLineupSlots(value: unknown): LineupSlot[] {
  const entries = Array.isArray(value) ? value : [value];
  const slots: LineupSlot[] = [];
  const seenMusicians = new Set<string>();
  for (const entry of entries) {
    if (typeof entry === "string" && entry.trim().length > 0) {
      const musicianId = entry.trim();
      if (seenMusicians.has(musicianId)) continue;
      seenMusicians.add(musicianId);
      slots.push({ slot: slots.length + 1, musicianId });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as {
      slot?: unknown;
      musicianId?: unknown;
      presetOverride?: unknown;
      drumDefinition?: unknown;
    };
    if (
      typeof raw.musicianId !== "string" ||
      raw.musicianId.trim().length === 0
    )
      continue;
    const musicianId = raw.musicianId.trim();
    if (seenMusicians.has(musicianId)) continue;
    seenMusicians.add(musicianId);
    const slotNumber =
      typeof raw.slot === "number" && Number.isFinite(raw.slot) && raw.slot > 0
        ? Math.floor(raw.slot)
        : slots.length + 1;
    slots.push({
      slot: slotNumber,
      musicianId,
      ...(raw.presetOverride && typeof raw.presetOverride === "object"
        ? { presetOverride: raw.presetOverride }
        : {}),
      ...(raw.drumDefinition && typeof raw.drumDefinition === "object"
        ? { drumDefinition: raw.drumDefinition as LineupSlot["drumDefinition"] }
        : {}),
    });
  }
  return slots.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
}

/** Converts legacy {slot, musicianId} vocal overlay arrays to canonical string[]. */
export function normalizeLegacyVocalOverlayArrayForCleanup(
  value: unknown,
): unknown[] {
  if (!Array.isArray(value)) return [];
  type LegacyEntry = { slot?: unknown; musicianId?: unknown };
  const indexed: Array<[number, string]> = [];
  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (typeof entry === "string" && entry.trim().length > 0) {
      indexed.push([i + 1, entry.trim()]);
    } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const raw = entry as LegacyEntry;
      if (
        typeof raw.musicianId !== "string" ||
        raw.musicianId.trim().length === 0
      )
        continue;
      const id = raw.musicianId.trim();
      const slot =
        typeof raw.slot === "number" &&
        Number.isFinite(raw.slot) &&
        raw.slot > 0
          ? Math.floor(raw.slot)
          : i + 1;
      indexed.push([slot, id]);
    }
  }
  indexed.sort((a, b) => a[0] - b[0]);
  const seen = new Set<string>();
  return indexed.flatMap(([, id]) => {
    if (seen.has(id)) return [];
    seen.add(id);
    return [id];
  });
}

function normalizeOverlayIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim().length === 0) continue;
    ids.push(entry.trim());
  }
  return ids;
}

function dedupeOverlayIds(ids: string[]): string[] {
  const seenMusicians = new Set<string>();
  return ids.filter((musicianId) => {
    if (seenMusicians.has(musicianId)) return false;
    seenMusicians.add(musicianId);
    return true;
  });
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`Missing or invalid ${label}.`);
  return value.trim();
}

function assertPurpose(value: unknown): StagePlanPurpose {
  if (value === "event" || value === "generic") return value;
  throw new Error("Missing or invalid purpose.");
}

function normalizeCanonicalOverlays(
  input: ProjectJson,
  lineup: ProjectLineup | undefined,
): ProjectOverlays | undefined {
  if (
    !("overlays" in input) ||
    !input.overlays ||
    typeof input.overlays !== "object"
  )
    return undefined;
  const raw = input.overlays as {
    leadVocals?: unknown;
    backVocals?: unknown;
    talkback?: unknown;
  };
  const hasLead = Object.prototype.hasOwnProperty.call(raw, "leadVocals");
  const hasBack = Object.prototype.hasOwnProperty.call(raw, "backVocals");
  const hasTalkback = Object.prototype.hasOwnProperty.call(raw, "talkback");

  const lineupMemberIds = new Set(
    Object.values(lineup ?? {}).flatMap((slots) =>
      Array.isArray(slots) ? slots.map((slot) => slot.musicianId) : [],
    ),
  );
  const leadVocals = dedupeOverlayIds(
    normalizeOverlayIds(
      normalizeLegacyVocalOverlayArrayForCleanup(raw.leadVocals),
    ),
  ).filter(
    (musicianId) =>
      lineupMemberIds.size === 0 || lineupMemberIds.has(musicianId),
  );
  const backVocals = dedupeOverlayIds(
    normalizeOverlayIds(
      normalizeLegacyVocalOverlayArrayForCleanup(raw.backVocals),
    ),
  ).filter(
    (musicianId) =>
      lineupMemberIds.size === 0 || lineupMemberIds.has(musicianId),
  );

  const talkback = (() => {
    if (!raw.talkback || typeof raw.talkback !== "object") return undefined;
    const mode = (raw.talkback as { mode?: unknown }).mode;
    const ownerId = (raw.talkback as { ownerId?: unknown }).ownerId;
    if (mode === "none") return { mode: "none" as const, ownerId: null };
    if (
      mode === "assigned" &&
      typeof ownerId === "string" &&
      ownerId.trim().length > 0
    ) {
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

/**
 * Layout prochází normalizací, protože `stageplan` se dřív jen přiřadil a
 * věřilo se typu — ručně editovaný JSON tak dostal do domény cokoli.
 */
function normalizeProjectStageplan(
  value: Project["stageplan"],
): Project["stageplan"] {
  if (!value || typeof value !== "object") return undefined;
  const layout = normalizeStageplanLayout(value.layout);
  const powerOverridesByMusician = value.powerOverridesByMusician;
  if (!layout && !powerOverridesByMusician) return undefined;
  return {
    ...(powerOverridesByMusician ? { powerOverridesByMusician } : {}),
    ...(layout ? { layout } : {}),
  };
}

/** Prázdné pořadí se nedrží — absence pole znamená „řiď se výpočtem" (R8). */
function normalizeInputOrder(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keys = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return keys.length > 0 ? keys : undefined;
}

function normalizeProjectNotes(
  value: unknown,
): ProjectNotesOverride | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    disabled?: unknown;
    overrides?: unknown;
    custom?: unknown;
  };

  const disabled = Array.isArray(raw.disabled)
    ? raw.disabled
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

  const overrides: Record<string, string> = {};
  if (raw.overrides && typeof raw.overrides === "object") {
    for (const [id, text] of Object.entries(
      raw.overrides as Record<string, unknown>,
    )) {
      if (typeof text === "string" && text.trim().length > 0) {
        overrides[id] = text;
      }
    }
  }

  const custom = Array.isArray(raw.custom)
    ? raw.custom
        .filter(
          (
            entry,
          ): entry is { id: string; section: "inputs" | "monitors"; text: string } =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof (entry as { id?: unknown }).id === "string" &&
            typeof (entry as { text?: unknown }).text === "string" &&
            ((entry as { section?: unknown }).section === "inputs" ||
              (entry as { section?: unknown }).section === "monitors"),
        )
        .map((entry) => ({
          id: entry.id.trim(),
          section: entry.section,
          text: entry.text,
        }))
        .filter((entry) => entry.id.length > 0 && entry.text.trim().length > 0)
    : [];

  const hasAnything =
    disabled.length > 0 || Object.keys(overrides).length > 0 || custom.length > 0;
  if (!hasAnything) return undefined;

  return {
    ...(disabled.length > 0 ? { disabled } : {}),
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
    ...(custom.length > 0 ? { custom } : {}),
  };
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

  const stageplan = normalizeProjectStageplan((input as ProjectJson).stageplan);
  const inputOrder = normalizeInputOrder(
    (input as { inputOrder?: unknown }).inputOrder,
  );
  const notes = normalizeProjectNotes((input as { notes?: unknown }).notes);
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
  const contentUpdatedAt =
    "contentUpdatedAt" in input &&
    typeof input.contentUpdatedAt === "string" &&
    input.contentUpdatedAt.trim().length > 0
      ? input.contentUpdatedAt.trim()
      : undefined;
  const lineup = (() => {
    if (
      !("lineup" in input) ||
      !input.lineup ||
      typeof input.lineup !== "object"
    )
      return undefined;
    const rawLineup = input.lineup as Record<string, unknown>;
    const normalized: ProjectLineup = {};
    for (const group of ["drums", "bass", "guitar", "keys", "vocs"] as const) {
      if (!isGroup(group)) continue;
      normalized[group as keyof ProjectLineup] = normalizeLineupSlots(
        rawLineup[group],
      );
    }
    return normalized;
  })();
  const overlays = normalizeCanonicalOverlays(input, lineup);
  const bandLeaderId =
    "bandLeaderId" in input &&
    typeof input.bandLeaderId === "string" &&
    input.bandLeaderId.trim().length > 0
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
        contentUpdatedAt,
        template: input.template?.trim() || undefined,
        lineup,
        overlays,
        bandLeaderId,
        stageplan,
        inputOrder,
        notes,
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
      contentUpdatedAt,
      template: input.template?.trim() || undefined,
      lineup,
      overlays,
      bandLeaderId,
      stageplan,
      inputOrder,
      notes,
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
      contentUpdatedAt,
      lineup,
      overlays,
      bandLeaderId,
      stageplan,
      inputOrder,
      notes,
    };
  }

  throw new Error("Unsupported project schema.");
}
