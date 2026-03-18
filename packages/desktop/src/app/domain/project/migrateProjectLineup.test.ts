import { describe, expect, it } from "vitest";
import { migrateProjectLineupVocsToLeadBack } from "./migrateProjectLineup";

describe("migrateProjectLineupVocsToLeadBack", () => {
  it("moves legacy lead_vocs to vocs and derives leadVocalistIds", () => {
    const migrated = migrateProjectLineupVocsToLeadBack({
      id: "p-1",
      purpose: "event",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      eventDate: "2026-01-01",
      eventVenue: "Venue",
      createdAt: "2026-01-01T00:00:00.000Z",
      lineup: { lead_vocs: ["lead-1"] },
    });

    expect(migrated.lineup?.vocs).toEqual(["lead-1"]);
    expect(migrated.lineup).not.toHaveProperty("back_vocs");
    expect(migrated.lineup).not.toHaveProperty("lead_vocs");
    expect(migrated.leadVocalistIds).toEqual(["lead-1"]);
  });

  it("preserves explicit empty back_vocs selection and explicit empty lead override", () => {
    const migrated = migrateProjectLineupVocsToLeadBack({
      id: "p-2",
      purpose: "event",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      eventDate: "2026-01-01",
      eventVenue: "Venue",
      createdAt: "2026-01-01T00:00:00.000Z",
      leadVocalistIds: [],
      lineup: { lead_vocs: ["lead-1"], back_vocs: [] },
    });

    expect(migrated.lineup?.back_vocs).toEqual([]);
    expect(migrated.leadVocalistIds).toEqual([]);
  });

  it("does not override explicit leadVocalistIds when legacy lead_vocs is also present", () => {
    const migrated = migrateProjectLineupVocsToLeadBack({
      id: "p-3",
      purpose: "event",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      eventDate: "2026-01-01",
      eventVenue: "Venue",
      createdAt: "2026-01-01T00:00:00.000Z",
      leadVocalistIds: ["keys-1"],
      lineup: { lead_vocs: ["lead-1"], vocs: ["voc-1"] },
    });

    expect(migrated.leadVocalistIds).toEqual(["keys-1"]);
    expect(migrated.lineup?.vocs).toEqual(["voc-1"]);
  });
});
