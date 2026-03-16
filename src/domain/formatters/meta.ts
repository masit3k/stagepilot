import type { MetaLineModel } from "../model/types.js";

export function formatDocumentDate(isoDate: string): string {
  const normalized = (isoDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const d = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

function resolveUpdatedDateIso(args: {
  updatedAt?: string;
  documentDate: string;
}): string {
  const updatedDate = (args.updatedAt ?? "").trim();
  if (updatedDate) {
    const isoDate = updatedDate.includes("T")
      ? updatedDate.slice(0, 10)
      : updatedDate;
    if (formatDocumentDate(isoDate)) return isoDate;
  }

  return args.documentDate;
}

export function formatProjectMetaLine(args: {
  purpose: "event" | "general";
  eventDate?: string;
  eventVenue?: string;
  documentDate: string;
  updatedAt?: string;
  note?: string;
}): MetaLineModel {
  const updatedDate = formatDocumentDate(
    resolveUpdatedDateIso({
      updatedAt: args.updatedAt,
      documentDate: args.documentDate,
    }),
  );

  if (args.purpose === "event") {
    const eventDate = formatDocumentDate(args.eventDate ?? "");
    const venue = (args.eventVenue ?? "").trim();
    return {
      kind: "labeled",
      label: "Datum akce a místo konání:",
      value: `${eventDate}, ${venue} (datum aktualizace: ${updatedDate})`,
    };
  }

  const note = args.note?.trim() || "Stage plan";
  return {
    kind: "plain",
    value: `${note} (datum aktualizace: ${updatedDate})`,
  };
}
