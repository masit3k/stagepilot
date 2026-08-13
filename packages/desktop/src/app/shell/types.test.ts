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

  it("drops legacy lineup.back_vocs selection", () => {
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

    expect(persisted.lineup).not.toHaveProperty("back_vocs");
  });

  it("serializes canonical overlay arrays", () => {
    const persisted = toPersistableProject({
      id: "p-2",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      overlays: {
        leadVocals: ["lead-1"],
        backVocals: [],
        talkback: { mode: "none", ownerId: null },
      },
    });

    expect(persisted.overlays).toEqual({
      leadVocals: ["lead-1"],
      backVocals: [],
      talkback: { mode: "none", ownerId: null },
    });
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
        leadVocals: ["lead-1"],
        backVocals: ["voc-2"],
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
      leadVocals: ["lead-1"],
      backVocals: ["voc-2"],
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

describe("toPersistableProject stageplan persistence", () => {
  const layout = {
    stage: { widthM: 10, depthM: 6 },
    blocks: [
      {
        slot: "drums" as const,
        centerXM: 1.5,
        centerYM: 4.2,
        widthM: 2.8,
        depthM: 1.6,
        rotationDeg: 45,
      },
    ],
  };

  it("keeps the stage plan layout", () => {
    const persisted = toPersistableProject({
      id: "p-5",
      purpose: "event",
      eventDate: "2026-06-01",
      eventVenue: "Arena",
      bandRef: "band-1",
      documentDate: "2026-06-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      stageplan: { layout },
    });

    expect(persisted.stageplan?.layout).toEqual(layout);
  });

  it("keeps the layout when a lineup change is saved from the setup screen", () => {
    const persisted = toPersistableProject({
      id: "p-6",
      purpose: "event",
      eventDate: "2026-06-01",
      eventVenue: "Arena",
      bandRef: "band-1",
      documentDate: "2026-06-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      lineup: { drums: "drummer-2", bass: "bass-1" },
      stageplan: {
        layout,
        powerOverridesByMusician: { "bass-1": { voltage: 230, sockets: 5 } },
      },
    });

    expect(persisted.stageplan?.layout).toEqual(layout);
    expect(persisted.stageplan?.powerOverridesByMusician).toEqual({
      "bass-1": { voltage: 230, sockets: 5 },
    });
  });

  it("omits the stageplan key entirely when there is nothing to store", () => {
    const persisted = toPersistableProject({
      id: "p-7",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect("stageplan" in persisted).toBe(false);
  });
});
