import { describe, expect, it } from "vitest";
import type { Project } from "../model/types.js";
import {
  resolveProjectBackVocsState,
  resolveProjectTalkbackState,
} from "./resolveProjectAudioAssignments.js";

describe("resolveProjectBackVocsState", () => {
  it("does not compute back vocals from defaults when explicit value is missing", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: "voc-back" },
    };

    const resolved = resolveProjectBackVocsState({
      project,
    });

    expect(resolved.hasExplicitBackVocsOverride).toBe(false);
    expect(resolved.defaultBackVocs).toEqual([]);
    expect(resolved.effectiveBackVocs).toEqual([]);
  });

  it("respects explicit empty overlays.backVocals override", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: "voc-back" },
      overlays: { backVocals: [] },
    };

    const resolved = resolveProjectBackVocsState({
      project,
    });

    expect(resolved.hasExplicitBackVocsOverride).toBe(true);
    expect(resolved.effectiveBackVocs).toEqual([]);
  });
});

describe("resolveProjectTalkbackState", () => {
  it("uses default talkback when override missing", () => {
    const project: Project = {
      id: "p-2",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const resolved = resolveProjectTalkbackState({
      project,
      activeMusicianIds: ["leader-1"],
      defaultTalkbackOwnerId: "leader-1",
    });

    expect(resolved.hasExplicitTalkbackOverride).toBe(false);
    expect(resolved.effectiveTalkbackOwnerId).toBe("leader-1");
  });

  it("treats explicit overlays talkback none as none", () => {
    const project: Project = {
      id: "p-2",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      overlays: { talkback: { mode: "none", ownerId: null } },
    };

    const resolved = resolveProjectTalkbackState({
      project,
      activeMusicianIds: ["leader-1"],
      defaultTalkbackOwnerId: "leader-1",
    });

    expect(resolved.hasExplicitTalkbackOverride).toBe(true);
    expect(resolved.isExplicitNone).toBe(true);
    expect(resolved.effectiveTalkbackOwnerId).toBe("leader-1");
  });
});
