import { describe, expect, it } from "vitest";
import type { ProjectJsonV2 } from "../../domain/model/types.js";
import { normalizeProject } from "./normalizeProject.js";

const base: ProjectJsonV2 = {
  id: "p-1",
  bandRef: "band-1",
  purpose: "generic",
  documentDate: "2026-01-01",
  lineup: { vocs: ["voc-1", "voc-2"], guitar: ["gtr-1"] },
};

describe("normalizeProject", () => {
  it("keeps only canonical overlays in normalized project", () => {
    const normalized = normalizeProject({
      ...base,
      overlays: {
        leadVocals: [{ slot: 1, musicianId: "voc-2" }],
        backVocals: [{ slot: 1, musicianId: "gtr-1" }],
        talkback: { mode: "assigned", ownerId: "gtr-1" },
      },
      leadVocalistIds: ["legacy-lead"],
      backVocalIds: ["legacy-back"],
      talkbackOverride: { mode: "assigned", musicianId: "legacy" },
    } as ProjectJsonV2);

    expect(normalized.overlays).toEqual({
      leadVocals: [{ slot: 1, musicianId: "voc-2" }],
      backVocals: [{ slot: 1, musicianId: "gtr-1" }],
      talkback: { mode: "assigned", ownerId: "gtr-1" },
    });
    expect(normalized.leadVocalistIds).toBeUndefined();
    expect(normalized.backVocalIds).toBeUndefined();
    expect(normalized.talkbackOverride).toBeUndefined();
  });

  it("drops invalid talkback owner outside lineup", () => {
    const normalized = normalizeProject({
      ...base,
      overlays: {
        talkback: { mode: "assigned", ownerId: "ghost" },
      },
    } as ProjectJsonV2);

    expect(normalized.overlays?.talkback).toEqual({
      mode: "none",
      ownerId: null,
    });
  });

  it("normalizes lineup roles and removes duplicate musicians per role", () => {
    const normalized = normalizeProject({
      ...base,
      lineup: {
        drums: ["dr-1", "dr-2", "dr-1"],
        bass: "b-1",
        guitar: null,
      },
    } as ProjectJsonV2);

    expect(normalized.lineup).toEqual({
      drums: [
        { slot: 1, musicianId: "dr-1" },
        { slot: 2, musicianId: "dr-2" },
      ],
      bass: [{ slot: 1, musicianId: "b-1" }],
      guitar: [],
      keys: [],
      vocs: [],
    });
  });
});
