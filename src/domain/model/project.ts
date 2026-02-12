export type Project =
  | {
    id: string;
    slug?: string;
    displayName?: string;
    bandRef: string;
    purpose: "event";
    eventDate: string;
    eventVenue: string;
    documentDate: string;
  }
  | {
    id: string;
    slug?: string;
    displayName?: string;
    bandRef: string;
    purpose: "generic";
    documentDate: string;
    note: string;
  };
