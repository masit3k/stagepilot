import { describe, expect, it } from "vitest";
import { formatDocumentDate, formatProjectMetaLine } from "./meta.js";

describe("formatDocumentDate", () => {
  it("formats ISO date as D. M. YYYY", () => {
    expect(formatDocumentDate("2026-03-07")).toBe("7. 3. 2026");
  });

  it("returns empty string for invalid dates", () => {
    expect(formatDocumentDate("")).toBe("");
    expect(formatDocumentDate("RRRR-01-01")).toBe("");
  });
});

describe("formatProjectMetaLine", () => {
  it("uses updatedAt date for event template update line", () => {
    const line = formatProjectMetaLine({
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      updatedAt: "2026-03-12T09:45:00.000Z",
    });

    expect(line).toEqual({
      kind: "labeled",
      label: "Datum akce a místo konání:",
      value: "10. 3. 2026, Klub (datum aktualizace: 12. 3. 2026)",
    });
  });

  it("formats generic note + year + updatedAt as one line", () => {
    const line = formatProjectMetaLine({
      purpose: "general",
      note: "Léto s Blaníkem",
      documentDate: "2026-01-01",
      updatedAt: "2026-03-16T09:45:00.000Z",
    });

    expect(line).toEqual({
      kind: "plain",
      value: "Léto s Blaníkem 2026 (datum aktualizace: 16. 3. 2026)",
    });
  });

  it("formats generic note only with updatedAt", () => {
    const line = formatProjectMetaLine({
      purpose: "general",
      note: "Léto s Blaníkem",
      documentDate: "",
      updatedAt: "2026-03-16T09:45:00.000Z",
    });

    expect(line).toEqual({
      kind: "plain",
      value: "Léto s Blaníkem (datum aktualizace: 16. 3. 2026)",
    });
  });

  it("formats generic year only with updatedAt", () => {
    const line = formatProjectMetaLine({
      purpose: "general",
      documentDate: "2026-01-01",
      updatedAt: "2026-03-16T09:45:00.000Z",
    });

    expect(line).toEqual({
      kind: "plain",
      value: "2026 (datum aktualizace: 16. 3. 2026)",
    });
  });

  it("falls back to documentDate when updatedAt is invalid", () => {
    const eventLine = formatProjectMetaLine({
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      updatedAt: "RRRR-01-01",
    });
    const genericLine = formatProjectMetaLine({
      purpose: "general",
      note: "Tour",
      documentDate: "2026-01-01",
      updatedAt: "RRRR-01-01",
    });

    expect(eventLine).toEqual({
      kind: "labeled",
      label: "Datum akce a místo konání:",
      value: "10. 3. 2026, Klub (datum aktualizace: 1. 1. 2026)",
    });
    expect(genericLine).toEqual({
      kind: "plain",
      value: "Tour 2026 (datum aktualizace: 1. 1. 2026)",
    });
  });
});
