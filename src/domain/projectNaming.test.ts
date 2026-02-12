import { describe, expect, it } from "vitest";
import {
  formatEventDateForDisplayName,
  formatEventDateForSlug,
  formatProjectDisplayName,
  formatProjectSlug,
  isUuidV7,
  migrateProjectIdentity,
  sanitizeVenueForSlug,
} from "./projectNaming.js";

describe("project naming", () => {
  const band = { id: "couple_of_sounds", code: "CoS", name: "Couple of Sounds" };

  it("formats slug for event projects", () => {
    expect(
      formatProjectSlug(
        { purpose: "event", eventDate: "2026-02-20", eventVenue: "Mladá Boleslav" },
        band,
      ),
    ).toBe("CoS_Inputlist_Stageplan_20-02-2026_Mlada-Boleslav");
  });

  it("formats displayName with full band name and en dash", () => {
    expect(
      formatProjectDisplayName(
        { purpose: "event", eventDate: "2026-02-20", eventVenue: "Praha" },
        band,
      ),
    ).toBe("Couple of Sounds – 20/02/2026 – Praha");
  });

  it("formats date variants and sanitizes slug segment", () => {
    expect(formatEventDateForSlug("2026-02-20")).toBe("20-02-2026");
    expect(formatEventDateForDisplayName("2026-02-20")).toBe("20/02/2026");
    expect(sanitizeVenueForSlug(" Nové Město / Praha? ")).toBe("Nove-Mesto-Praha");
  });

  it("migrates legacy id to uuidv7 and computes canonical naming", () => {
    const migrated = migrateProjectIdentity(
      {
        id: "CoS_Inputlist_Stageplan_20-02-2026_Praha",
        purpose: "event",
        eventDate: "2026-02-20",
        eventVenue: "Praha",
      },
      band,
    );
    expect(isUuidV7(migrated.id || "")).toBe(true);
    expect(migrated.slug).toBe("CoS_Inputlist_Stageplan_20-02-2026_Praha");
    expect(migrated.displayName).toBe("Couple of Sounds – 20/02/2026 – Praha");
  });
});
