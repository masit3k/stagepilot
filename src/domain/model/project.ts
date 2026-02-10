export type Project =
  | {
    id: string;
    bandRef: string;
    purpose: "event";
    eventDate: string;
    eventVenue: string;
    documentDate: string;
  }
  | {
    id: string;
    bandRef: string;
    purpose: "generic";
    documentDate: string;
    note: string;
  };
