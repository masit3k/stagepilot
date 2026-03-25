import { describe, expect, it } from "vitest";
import type { Project } from "../model/types.js";
import {
  resolveCanonicalOverlayAssignments,
  resolveProjectTalkbackState,
} from "./resolveProjectAudioAssignments.js";

describe("resolveCanonicalOverlayAssignments", () => {
  it("returns only lineup-member canonical overlay slots", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1"], guitar: ["gtr-1"] },
      overlays: {
        leadVocals: [{ slot: 1, musicianId: "voc-1" }, { slot: 2, musicianId: "ghost" }],
      },
    };

    expect(resolveCanonicalOverlayAssignments({ project, role: "leadVocals" })).toEqual([
      { slot: 1, musicianId: "voc-1" },
    ]);
  });
});

describe("resolveProjectTalkbackState", () => {
  it("fails closed when talkback overlay is missing", () => {
    const project: Project = {
      id: "p-2",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const resolved = resolveProjectTalkbackState({
      project,
      activeMusicianIds: ["leader-1"],
    });

    expect(resolved.effectiveTalkbackOwnerId).toBeNull();
    expect(resolved.hasExplicitTalkbackOverride).toBe(false);
  });

  it("treats explicit overlays talkback none as terminal none", () => {
    const project: Project = {
      id: "p-3",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      overlays: { talkback: { mode: "none", ownerId: null } },
    };

    const resolved = resolveProjectTalkbackState({
      project,
      activeMusicianIds: ["leader-1"],
    });

    expect(resolved.isExplicitNone).toBe(true);
    expect(resolved.effectiveTalkbackOwnerId).toBeNull();
  });
});
