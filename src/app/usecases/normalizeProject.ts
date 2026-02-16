import type { Project, ProjectJson, StagePlanPurpose } from "../../domain/model/types.js";

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
  const slug = typeof raw.slug === "string" ? raw.slug.trim() || undefined : undefined;
  const displayName = typeof raw.displayName === "string" ? raw.displayName.trim() || undefined : undefined;
  const stageplan = (input as ProjectJson).stageplan;
  const lineup = "lineup" in input ? input.lineup : undefined;
  const bandLeaderId = "bandLeaderId" in input && typeof input.bandLeaderId === "string" && input.bandLeaderId.trim().length > 0
    ? input.bandLeaderId.trim()
    : undefined;
  const talkbackOwnerId = "talkbackOwnerId" in input && typeof input.talkbackOwnerId === "string" && input.talkbackOwnerId.trim().length > 0
    ? input.talkbackOwnerId.trim()
    : undefined;
  const backVocalIds = "backVocalIds" in input && Array.isArray(input.backVocalIds)
    ? input.backVocalIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;

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
        template: input.template?.trim() || undefined,
        lineup,
        backVocalIds,
        bandLeaderId,
        talkbackOwnerId,
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
      template: input.template?.trim() || undefined,
      lineup,
      backVocalIds,
      bandLeaderId,
      talkbackOwnerId,
      stageplan,
    };
  }

  if ("date" in input) {
    const eventDate = assertString(input.date, "date");
    const eventVenue =
      typeof input.venue === "string" && input.venue.trim() ? input.venue.trim() : undefined;
    return {
      id,
      bandRef,
      slug,
      displayName,
      purpose: "event",
      eventDate,
      eventVenue,
      documentDate: eventDate,
      lineup,
      backVocalIds,
      bandLeaderId,
      talkbackOwnerId,
      stageplan,
    };
  }

  throw new Error("Unsupported project schema.");
}
