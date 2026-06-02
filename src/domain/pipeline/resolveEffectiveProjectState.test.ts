import { describe, expect, it } from "vitest";
import type { Project } from "../model/types.js";
import { resolveEffectiveProjectState } from "./resolveEffectiveProjectState.js";

describe("resolveEffectiveProjectState", () => {
  it("inherits lineup from band defaultLineup when project has no explicit lineup", () => {
    const project: Project = {
      id: "p-inherit-lineup",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: {
        drums: ["dr-1"],
        bass: ["bass-1"],
      },
      bandLeaderId: "leader-1",
    });

    expect(resolved.effectiveLineup.drums).toEqual(["dr-1"]);
    expect(resolved.effectiveLineup.bass).toEqual(["bass-1"]);
  });

  it("keeps project role lineup ahead of band defaultLineup", () => {
    const project: Project = {
      id: "p-project-lineup",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: {
        bass: ["project-bass"],
      },
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: {
        bass: ["band-bass"],
        guitar: ["band-guitar"],
      },
      bandLeaderId: "leader-1",
    });

    expect(resolved.effectiveLineup.bass).toEqual(["project-bass"]);
    expect(resolved.effectiveLineup.guitar).toEqual(["band-guitar"]);
  });

  it("preserves empty fallback when project and band have no lineup", () => {
    const project: Project = {
      id: "p-no-lineup",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandLeaderId: "leader-1",
    });

    expect(resolved.effectiveLineup.drums).toEqual([]);
    expect(resolved.effectiveLineup.bass).toEqual([]);
    expect(resolved.effectiveLineup.guitar).toEqual([]);
    expect(resolved.effectiveLineup.keys).toEqual([]);
    expect(resolved.effectiveLineup.vocs).toEqual([]);
    expect(resolved.effectiveLineup.talkback).toEqual([]);
  });

  it("treats an explicit empty project role as overriding band defaultLineup", () => {
    const project: Project = {
      id: "p-empty-role",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: {
        bass: [],
      },
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: {
        bass: ["band-bass"],
      },
      bandLeaderId: "leader-1",
    });

    expect(resolved.effectiveLineup.bass).toEqual([]);
  });

  it("uses canonical overlays for lead/back/talkback state", () => {
    const project: Project = {
      id: "p-overlays",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: {
        vocs: ["lead-1", "lead-2", "back-1"],
        guitar: ["talkback-1"],
      },
      overlays: {
        leadVocals: ["lead-1", "lead-2"],
        backVocals: ["back-1"],
        talkback: { mode: "assigned", ownerId: "talkback-1" },
      },
    };

    const resolved = resolveEffectiveProjectState({ project, bandLeaderId: "leader-1" });

    expect(resolved.effectiveOverlays.leadVocals).toEqual(["lead-1", "lead-2"]);
    expect(resolved.effectiveOverlays.backVocals).toEqual(["back-1"]);
    expect(resolved.effectiveTalkbackOwnerId).toBe("talkback-1");
  });

  it("uses band default talkback owner when it is part of the effective lineup", () => {
    const project: Project = {
      id: "p-inherited-talkback",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: { bass: ["bass-1"] },
      bandDefaultTalkbackOwnerId: "bass-1",
      bandLeaderId: "leader-1",
    });

    expect(resolved.effectiveTalkbackOwnerId).toBe("bass-1");
  });

  it("keeps explicit project talkback override ahead of band default talkback owner", () => {
    const project: Project = {
      id: "p-explicit-talkback",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      overlays: {
        talkback: { mode: "none", ownerId: null },
      },
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: { bass: ["bass-1"] },
      bandDefaultTalkbackOwnerId: "bass-1",
      bandLeaderId: "leader-1",
    });

    expect(resolved.effectiveTalkbackOwnerId).toBe("");
  });

  it("fails closed for missing/legacy talkback sources", () => {
    const project: Project = {
      id: "p-legacy",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { bass: ["bass-1"] },
    };

    const resolved = resolveEffectiveProjectState({ project, bandLeaderId: "leader-1" });
    expect(resolved.effectiveTalkbackOwnerId).toBe("");
  });

  it("normalizes malformed persisted drum definition instead of crashing load", () => {
    const project: Project = {
      id: "p-drum-malformed",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: {
        drums: {
          musicianId: "drummer-1",
          drumDefinition: { kickCount: 2, kicks: [{}] } as unknown as never,
        },
      },
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: {},
      bandLeaderId: "leader-1",
    });

    const drumDefinition = resolved.drumDefinitionByMusicianId.get("drummer-1");
    expect(drumDefinition?.kickCount).toBe(2);
  });
});
