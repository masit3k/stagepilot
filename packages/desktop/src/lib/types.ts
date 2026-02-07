export type StagePlanPurpose = "event" | "generic";

export type ProjectSummary = {
  id: string;
  bandRef: string;
  purpose: StagePlanPurpose;
  documentDate: string;
  eventDate?: string;
  eventVenue?: string;
  title?: string;
};

export type VersionSummary = {
  versionId: string;
  generatedAt: string;
  pdfFileName: string;
};
