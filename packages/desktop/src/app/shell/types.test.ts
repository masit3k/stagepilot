import { describe, expect, it } from "vitest";
import { toPersistableProject } from "./types";

describe("toPersistableProject talkback persistence", () => {
  it("preserves explicit empty talkbackOwnerId when present", () => {
    const persisted = toPersistableProject({
      id: "p-1",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      talkbackOwnerId: "",
    });

    expect(persisted).toHaveProperty("talkbackOwnerId", "");
  });

  it("keeps talkbackOwnerId absent when not provided", () => {
    const persisted = toPersistableProject({
      id: "p-1",
      purpose: "event",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
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
});
