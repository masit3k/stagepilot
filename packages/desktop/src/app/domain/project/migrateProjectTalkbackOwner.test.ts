import { describe, expect, it } from "vitest";
import { migrateProjectTalkbackOwner } from "./migrateProjectTalkbackOwner";

describe("migrateProjectTalkbackOwner", () => {
  it("keeps project untouched when talkbackOwnerId already exists", () => {
    const input = {
      id: "p-1",
      purpose: "generic" as const,
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      talkbackOwnerId: "",
    };

    expect(migrateProjectTalkbackOwner(input)).toEqual(input);
  });

  it("converts legacy talkbackOverride none to explicit empty talkbackOwnerId", () => {
    const migrated = migrateProjectTalkbackOwner({
      id: "p-1",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      talkbackOverride: { mode: "none" },
    });

    expect(migrated.talkbackOwnerId).toBe("");
  });
});
