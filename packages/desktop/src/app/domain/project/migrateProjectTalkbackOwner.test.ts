import { describe, expect, it } from "vitest";
import { migrateProjectTalkbackOwner } from "./migrateProjectTalkbackOwner";

describe("migrateProjectTalkbackOwner", () => {
  it("keeps project untouched when overlays talkback already exists", () => {
    const input = {
      id: "p-1",
      purpose: "generic" as const,
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      overlays: { talkback: { mode: "assigned" as const, ownerId: "voc-1" } },
    };

    expect(migrateProjectTalkbackOwner(input)).toEqual(input);
  });

  it("converts legacy talkbackOverride none to overlays talkback none", () => {
    const migrated = migrateProjectTalkbackOwner({
      id: "p-1",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      talkbackOverride: { mode: "none" },
    });

    expect(migrated.overlays?.talkback).toEqual({ mode: "none", ownerId: null });
  });

  it("normalizes legacy talkBackOwnerId casing into overlays talkback", () => {
    const migrated = migrateProjectTalkbackOwner({
      id: "p-1",
      purpose: "event",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      eventDate: "2026-01-02",
      eventVenue: "Club",
      ...( { talkBackOwnerId: "  drummer-1  " } as { talkBackOwnerId: string } ),
    });

    expect(migrated.overlays?.talkback).toEqual({ mode: "assigned", ownerId: "drummer-1" });
  });
});
