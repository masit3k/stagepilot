import { describe, expect, it } from "vitest";
import { toPersistableProject } from "./types";

describe("toPersistableProject talkback persistence", () => {
  it("does not serialize legacy root talkbackOwnerId", () => {
    const persisted = toPersistableProject({
      id: "p-1",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      ...( { talkbackOwnerId: "" } as { talkbackOwnerId: string } ),
    });

    expect("talkbackOwnerId" in persisted).toBe(false);
  });

  it("preserves explicit empty lineup.back_vocs selection", () => {
    const persisted = toPersistableProject({
      id: "p-1",
      purpose: "event",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      lineup: {
        vocs: ["lead-1"],
        back_vocs: [],
      },
    });

    expect(persisted.lineup).toHaveProperty("back_vocs");
    expect(persisted.lineup?.back_vocs).toEqual([]);
  });

  it("drops legacy lead/back vocal arrays when canonical overlays are present", () => {
    const persisted = toPersistableProject({
      id: "p-2",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      overlays: {
        leadVocals: [{ slot: 1, musicianId: "lead-1" }],
        backVocals: [],
        talkback: { mode: "none", ownerId: null },
      },
      leadVocalistIds: ["legacy-lead"],
      backVocalIds: ["legacy-back"],
    });

    expect(persisted).toHaveProperty("overlays");
    expect("leadVocalistIds" in persisted).toBe(false);
    expect("backVocalIds" in persisted).toBe(false);
  });

  it("serializes event lineup using canonical arrays and keeps event fields", () => {
    const persisted = toPersistableProject({
      id: "p-3",
      purpose: "event",
      eventDate: "2026-06-01",
      eventVenue: "Arena",
      bandRef: "band-1",
      documentDate: "2026-06-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      lineup: {
        drums: "drummer-1",
        bass: "bass-1",
        guitar: "guitar-1",
        keys: "keys-1",
        vocs: "lead-1",
      },
      overlays: {
        leadVocals: [{ slot: 1, musicianId: "lead-1" }],
        backVocals: [{ slot: 2, musicianId: "voc-2" }],
        talkback: { mode: "assigned", ownerId: "leader-1" },
      },
    });

    expect(persisted.eventDate).toBe("2026-06-01");
    expect(persisted.eventVenue).toBe("Arena");
    expect(persisted.lineup).toEqual({
      drums: ["drummer-1"],
      bass: ["bass-1"],
      guitar: ["guitar-1"],
      keys: ["keys-1"],
      vocs: ["lead-1"],
    });
    expect(persisted.overlays).toEqual({
      leadVocals: [{ slot: 1, musicianId: "lead-1" }],
      backVocals: [{ slot: 2, musicianId: "voc-2" }],
      talkback: { mode: "assigned", ownerId: "leader-1" },
    });
  });

  it("keeps generic note immediately after purpose in serialized payload", () => {
    const persisted = toPersistableProject({
      id: "p-4",
      purpose: "generic",
      note: "Tour 2026",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      lineup: {
        drums: "drummer-1",
        vocs: "lead-1",
      },
    });

    expect(persisted.note).toBe("Tour 2026");
    const keys = Object.keys(persisted);
    const purposeIndex = keys.indexOf("purpose");
    const noteIndex = keys.indexOf("note");
    expect(noteIndex).toBe(purposeIndex + 1);
    expect(persisted.lineup).toEqual({
      drums: ["drummer-1"],
      vocs: ["lead-1"],
    });
  });
});
