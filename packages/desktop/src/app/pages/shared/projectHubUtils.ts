import { formatIsoDateToUs, formatIsoToDateTimeDisplay } from "../../../projectRules";
import type { ProjectSummary } from "../../shell/types";

export function formatProjectDate(project: ProjectSummary) {
  if (project.updatedAt) return formatIsoToDateTimeDisplay(project.updatedAt);
  if (project.eventDate) return `${formatIsoDateToUs(project.eventDate)} 00:00`;
  if (project.createdAt) return formatIsoToDateTimeDisplay(project.createdAt);
  return "—";
}

export function getProjectPurposeLabel(purpose?: string | null) {
  if (purpose === "event") return "Project type: Event";
  if (purpose === "generic") return "Project type: Generic";
  return "—";
}

export function toIdSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}
