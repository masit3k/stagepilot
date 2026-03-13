import { describe, expect, it } from "vitest";
import type { Musician, Project } from "../model/types.js";
import {
  collectActiveLineupMusicianIds,
  resolveProjectBackVocsState,
  resolveProjectTalkbackState,
} from "./resolveProjectAudioAssignments.js";

const backVocalist: Musician = {
  id: "voc-back",
  firstName: "Back",
  lastName: "Voc",
  group: "vocs",
  presets: [{ kind: "vocal", ref: "vocal_back_no_mic", ownerKey: "vocs" }],
};

describe("resolveProjectBackVocsState", () => {
  it("computes defaults from active lineup musicians when explicit value is missing", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: "voc-back" },
    };

    const active = collectActiveLineupMusicianIds(project);
    const resolved = resolveProjectBackVocsState({
      project,
      activeMusicianIds: active,
      musiciansById: new Map([["voc-back", backVocalist]]),
    });

    expect(resolved.hasExplicitBackVocsOverride).toBe(false);
    expect(resolved.effectiveBackVocs).toEqual(["voc-back"]);
  });

  it("respects explicit empty back_vocs override", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: "voc-back", back_vocs: [] },
    };

    const resolved = resolveProjectBackVocsState({
      project,
      activeMusicianIds: ["voc-back"],
      musiciansById: new Map([["voc-back", backVocalist]]),
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

  it("treats explicit empty talkback owner as none", () => {
    const project: Project = {
      id: "p-2",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      talkbackOwnerId: "",
    };

    const resolved = resolveProjectTalkbackState({
      project,
      activeMusicianIds: ["leader-1"],
      defaultTalkbackOwnerId: "leader-1",
    });

    expect(resolved.hasExplicitTalkbackOverride).toBe(true);
    expect(resolved.isExplicitNone).toBe(true);
    expect(resolved.effectiveTalkbackOwnerId).toBeNull();
  });
});
