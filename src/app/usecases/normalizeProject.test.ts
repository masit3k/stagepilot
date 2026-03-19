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
});
