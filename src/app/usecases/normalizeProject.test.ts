import { describe, expect, it } from "vitest";
import { normalizeProject } from "./normalizeProject.js";
import type { ProjectJsonV2 } from "../../domain/model/types.js";

describe("normalizeProject", () => {
  it("preserves createdAt and updatedAt for generic projects", () => {
    const project: ProjectJsonV2 = {
      id: "g-1",
      bandRef: "pl",
      purpose: "generic",
      documentDate: "2026-01-01",
      note: "Léto s Blaníkem",
      createdAt: "2026-01-02T10:00:00.000Z",
      updatedAt: "2026-03-12T09:45:00.000Z",
    };

    const normalized = normalizeProject(project);

    expect(normalized.createdAt).toBe("2026-01-02T10:00:00.000Z");
    expect(normalized.updatedAt).toBe("2026-03-12T09:45:00.000Z");
  });

  it("preserves createdAt and updatedAt for event projects", () => {
    const project: ProjectJsonV2 = {
      id: "e-1",
      bandRef: "pl",
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      createdAt: "2026-01-02T10:00:00.000Z",
      updatedAt: "2026-03-12T09:45:00.000Z",
    };

    const normalized = normalizeProject(project);

    expect(normalized.createdAt).toBe("2026-01-02T10:00:00.000Z");
    expect(normalized.updatedAt).toBe("2026-03-12T09:45:00.000Z");
  });

  it("normalizes explicit lead vocalist ids", () => {
    const project: ProjectJsonV2 = {
      id: "e-2",
      bandRef: "pl",
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      leadVocalistIds: ["lead-1", "", "lead-2"],
    };

    const normalized = normalizeProject(project);

    expect(normalized.leadVocalistIds).toEqual(["lead-1", "lead-2"]);
  });

  it("preserves incoming lead/back vocal order and explicit empty arrays", () => {
    const project: ProjectJsonV2 = {
      id: "e-ordered-vocals",
      bandRef: "pl",
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      leadVocalistIds: ["lead-3", "lead-1", "lead-2"],
      backVocalIds: [],
    };

    const normalized = normalizeProject(project);

    expect(normalized.leadVocalistIds).toEqual(["lead-3", "lead-1", "lead-2"]);
    expect(normalized.backVocalIds).toEqual([]);
  });

  it("derives lead vocalist ids from legacy lineup.lead_vocs when explicit ids are absent", () => {
    const normalized = normalizeProject({
      id: "e-legacy",
      bandRef: "pl",
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      lineup: {
        lead_vocs: [{ musicianId: "lead-1" }, "lead-2", "", { musicianId: "" }],
      },
    } satisfies ProjectJsonV2);

    expect(normalized.leadVocalistIds).toEqual(["lead-1", "lead-2"]);
  });

  it("keeps explicit empty lead vocalist ids and does not fallback to legacy lineup.lead_vocs", () => {
    const normalized = normalizeProject({
      id: "e-explicit-empty",
      bandRef: "pl",
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      leadVocalistIds: [],
      lineup: {
        lead_vocs: ["legacy-lead"],
      },
    } satisfies ProjectJsonV2);

    expect(normalized.leadVocalistIds).toEqual([]);
  });

  it("normalizes canonical overlays and preserves slot order", () => {
    const normalized = normalizeProject({
      id: "p-overlay",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: {
        vocs: ["lead-1", "lead-2", "back-1"],
      },
      overlays: {
        leadVocals: [
          { slot: 2, musicianId: "lead-2" },
          { slot: 1, musicianId: "lead-1" },
        ],
        backVocals: [{ slot: 1, musicianId: "back-1" }],
        talkback: { mode: "none", ownerId: null },
      },
    } satisfies ProjectJsonV2);

    expect(normalized.overlays?.leadVocals?.map((slot) => slot.musicianId)).toEqual([
      "lead-1",
      "lead-2",
    ]);
    expect(normalized.overlays?.backVocals?.map((slot) => slot.musicianId)).toEqual([
      "back-1",
    ]);
    expect(normalized.overlays?.talkback).toEqual({ mode: "none", ownerId: null });
  });

  it("keeps explicit empty canonical overlays and does not fallback to legacy vocal ids", () => {
    const normalized = normalizeProject({
      id: "p-overlay-empty",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      leadVocalistIds: ["legacy-lead-1"],
      backVocalIds: ["legacy-back-1"],
      overlays: {
        leadVocals: [],
        backVocals: [],
      },
    } satisfies ProjectJsonV2);

    expect(normalized.overlays?.leadVocals).toEqual([]);
    expect(normalized.overlays?.backVocals).toEqual([]);
  });

  it("normalizes and preserves canonical root talkback owner id from both spellings", () => {
    const canonical = normalizeProject({
      id: "p-talkback-canonical",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      talkbackOwnerId: "  leader-1 ",
    } satisfies ProjectJsonV2);
    expect(canonical.talkbackOwnerId).toBe("leader-1");

    const legacySpelling = normalizeProject({
      id: "p-talkback-legacy-spelling",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      ...( { talkBackOwnerId: "  bassist-1  " } as { talkBackOwnerId: string } ),
    } as ProjectJsonV2 & { talkBackOwnerId: string });
    expect(legacySpelling.talkbackOwnerId).toBe("bassist-1");
  });

  it("derives back vocal ids from legacy lineup.back_vocs when explicit ids are absent", () => {
    const normalized = normalizeProject({
      id: "e-legacy-back",
      bandRef: "pl",
      purpose: "event",
      eventDate: "2026-03-10",
      eventVenue: "Klub",
      documentDate: "2026-01-01",
      lineup: {
        back_vocs: [{ musicianId: "back-1" }, "back-2"],
      },
    } satisfies ProjectJsonV2);

    expect(normalized.backVocalIds).toEqual(["back-1", "back-2"]);
  });
});
