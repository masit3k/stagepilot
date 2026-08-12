import { describe, expect, it } from "vitest";
import { formatDocumentDate, formatDocumentHeader } from "./meta.js";

describe("formatDocumentDate", () => {
  it("formats ISO date as D. M. YYYY", () => {
    expect(formatDocumentDate("2026-03-07")).toBe("7. 3. 2026");
  });

  it("returns empty string for invalid dates", () => {
    expect(formatDocumentDate("")).toBe("");
    expect(formatDocumentDate("RRRR-01-01")).toBe("");
  });
});

describe("formatDocumentHeader", () => {
  it("splits an event into date and venue", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-03-10",
        eventVenue: "Klub",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-12T09:45:00.000Z",
      }),
    ).toEqual({
      contextParts: ["10. 3. 2026", "Klub"],
      updatedDate: "12. 3. 2026",
    });
  });

  it("drops an empty venue instead of leaving a dangling separator", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-03-10",
        eventVenue: "   ",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-12T09:45:00.000Z",
      }).contextParts,
    ).toEqual(["10. 3. 2026"]);
  });

  it("drops an unparseable event date", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "RRRR-01-01",
        eventVenue: "Klub",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-12T09:45:00.000Z",
      }).contextParts,
    ).toEqual(["Klub"]);
  });

  it("joins note and validity year into one part for a general project", () => {
    expect(
      formatDocumentHeader({
        purpose: "general",
        note: "Léto s Blaníkem",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-16T09:45:00.000Z",
      }),
    ).toEqual({
      contextParts: ["Léto s Blaníkem 2026"],
      updatedDate: "16. 3. 2026",
    });
  });

  it("keeps the note alone when there is no validity year", () => {
    expect(
      formatDocumentHeader({
        purpose: "general",
        note: "Léto s Blaníkem",
        documentDate: "",
        updatedAt: "2026-03-16T09:45:00.000Z",
      }).contextParts,
    ).toEqual(["Léto s Blaníkem"]);
  });

  it("keeps the year alone when there is no note", () => {
    expect(
      formatDocumentHeader({
        purpose: "general",
        documentDate: "2026-01-01",
        updatedAt: "2026-03-16T09:45:00.000Z",
      }).contextParts,
    ).toEqual(["2026"]);
  });

  it("returns no context parts when a general project has neither", () => {
    expect(
      formatDocumentHeader({
        purpose: "general",
        documentDate: "",
        updatedAt: "2026-03-16T09:45:00.000Z",
      }).contextParts,
    ).toEqual([]);
  });

  it("prefers contentUpdatedAt over updatedAt", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-08-22",
        eventVenue: "Zámek Bon Repos",
        documentDate: "2026-01-01",
        updatedAt: "2026-07-30T09:45:00.000Z",
        contentUpdatedAt: "2026-07-15T09:45:00.000Z",
      }).updatedDate,
    ).toBe("15. 7. 2026");
  });

  it("falls back to updatedAt when contentUpdatedAt is missing", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-08-22",
        eventVenue: "Zámek Bon Repos",
        documentDate: "2026-01-01",
        updatedAt: "2026-07-30T09:45:00.000Z",
      }).updatedDate,
    ).toBe("30. 7. 2026");
  });

  it("falls back to documentDate when both stamps are invalid", () => {
    expect(
      formatDocumentHeader({
        purpose: "event",
        eventDate: "2026-08-22",
        eventVenue: "Zámek Bon Repos",
        documentDate: "2026-01-01",
        updatedAt: "RRRR-01-01",
        contentUpdatedAt: "RRRR-02-02",
      }).updatedDate,
    ).toBe("1. 1. 2026");
  });
});
