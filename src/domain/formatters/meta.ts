import type { MetaLineModel } from "../model/types.js";

export function formatDocumentDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export function formatProjectMetaLine(args: {
  purpose: "event" | "general";
  eventDate?: string;
  eventVenue?: string;
  documentDate: string;
  note?: string;
}): MetaLineModel {
  if (args.purpose === "event") {
    const eventDate = formatDocumentDate(args.eventDate ?? "");
    const venue = (args.eventVenue ?? "").trim();
    const docDate = formatDocumentDate(args.documentDate);
    return {
      kind: "labeled",
      label: "Datum akce a místo konání:",
      value: `${eventDate}, ${venue} (datum aktualizace: ${docDate})`,
    };
  }

  const note = args.note?.trim() || "Stage plan";
  const documentDate = formatDocumentDate(args.documentDate);
  return {
    kind: "plain",
    value: `${note} (datum aktualizace: ${documentDate})`,
  };
}
