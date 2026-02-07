export type StagePlanPurpose = "event" | "generic";

export interface Project {
  id: string;
  bandRef: string;

  purpose: StagePlanPurpose;

  // event-specific
  eventDate?: string;    // ISO YYYY-MM-DD
  eventVenue?: string;

  // always required
  documentDate: string;  // ISO YYYY-MM-DD

  // generic / descriptive
  title?: string;
}