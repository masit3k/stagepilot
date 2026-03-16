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
});
