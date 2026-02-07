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

  if ("purpose" in input) {
    const purpose = assertPurpose(input.purpose);
    const documentDate = assertString(input.documentDate, "documentDate");

    if (purpose === "event") {
      const eventDate = assertString(input.eventDate, "eventDate");
      const eventVenue = assertString(input.eventVenue, "eventVenue");
      return {
        id,
        bandRef,
        purpose,
        eventDate,
        eventVenue,
        documentDate,
        title: input.title?.trim() || undefined,
        template: input.template?.trim() || undefined,
      };
    }

    return {
      id,
      bandRef,
      purpose,
      documentDate,
      title: input.title?.trim() || undefined,
      template: input.template?.trim() || undefined,
    };
  }

  if ("date" in input) {
    const eventDate = assertString(input.date, "date");
    const eventVenue =
      typeof input.venue === "string" && input.venue.trim() ? input.venue.trim() : undefined;
    return {
      id,
      bandRef,
      purpose: "event",
      eventDate,
      eventVenue,
      documentDate: eventDate,
    };
  }

  throw new Error("Unsupported project schema.");
}
