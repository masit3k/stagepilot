import type { MetaLineModel } from "../model/types.js";

export function formatDocumentDate(isoDate: string): string {
  const normalized = (isoDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  const d = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

function toIsoDatePart(value?: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const isoDate = trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
  return formatDocumentDate(isoDate) ? isoDate : "";
}

function resolveUpdatedDateIso(args: {
  contentUpdatedAt?: string;
  updatedAt?: string;
  documentDate: string;
}): string {
  return (
    toIsoDatePart(args.contentUpdatedAt) ||
    toIsoDatePart(args.updatedAt) ||
    args.documentDate
  );
}

function extractYearFromIso(isoDate: string): string {
  const normalized = (isoDate ?? "").trim();
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(normalized);
  return match?.[1] ?? "";
}

export function formatProjectMetaLine(args: {
  purpose: "event" | "general";
  eventDate?: string;
  eventVenue?: string;
  documentDate: string;
  updatedAt?: string;
  contentUpdatedAt?: string;
  note?: string;
}): MetaLineModel {
  const updatedDate = formatDocumentDate(
    resolveUpdatedDateIso({
      contentUpdatedAt: args.contentUpdatedAt,
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

  const note = args.note?.trim() ?? "";
  const validityYear = extractYearFromIso(args.documentDate);
  const subtitle = [note, validityYear].filter(Boolean).join(" ");
  const updatePart = `datum aktualizace: ${updatedDate}`;
  const value = subtitle ? `${subtitle} (${updatePart})` : `(${updatePart})`;

  return {
    kind: "plain",
    value,
  };
}
