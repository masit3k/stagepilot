import { describe, expect, it } from "vitest";
import { migrateProjectLineupVocsToLeadBack } from "./migrateProjectLineup";

describe("migrateProjectLineupVocsToLeadBack", () => {
  it("moves legacy vocs to lead_vocs and defaults back_vocs", () => {
    const migrated = migrateProjectLineupVocsToLeadBack({
      id: "p-1",
      purpose: "event",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      eventDate: "2026-01-01",
      eventVenue: "Venue",
      createdAt: "2026-01-01T00:00:00.000Z",
      lineup: { vocs: ["lead-1"] },
    });

    expect(migrated.lineup?.lead_vocs).toEqual(["lead-1"]);
    expect(migrated.lineup?.back_vocs).toEqual([]);
    expect(migrated.lineup).not.toHaveProperty("vocs");
  });

  it("is idempotent for already migrated lineup", () => {
    const input = {
      id: "p-1",
      purpose: "generic" as const,
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      lineup: { lead_vocs: ["lead-1"], back_vocs: ["back-1"] },
    };

    expect(migrateProjectLineupVocsToLeadBack(input)).toEqual(input);
  });
});
