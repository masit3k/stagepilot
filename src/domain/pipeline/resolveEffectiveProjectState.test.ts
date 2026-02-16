import { describe, expect, it } from "vitest";
import type { Project } from "../model/types.js";
import { resolveEffectiveProjectState } from "./resolveEffectiveProjectState.js";

describe("resolveEffectiveProjectState", () => {
  it("prefers project lineup over band defaults", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: {
        drums: "drummer-new",
        guitar: "guitar-new",
      },
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: {
        drums: "drummer-default",
        guitar: "guitar-default",
      },
      bandLeaderId: "drummer-default",
    });

    expect(resolved.effectiveLineup.drums).toEqual(["drummer-new"]);
    expect(resolved.effectiveLineup.guitar).toEqual(["guitar-new"]);
  });

  it("captures per-slot preset override from project lineup", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: {
        bass: {
          musicianId: "bass-1",
          presetOverride: { inputs: { removeKeys: ["bass_di"], add: [{ key: "bass_pedal", label: "Bass pedalboard", group: "bass" }] } },
        },
      },
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: { bass: "bass-default" },
      bandLeaderId: "bass-default",
    });

    expect(resolved.effectiveLineup.bass).toEqual(["bass-1"]);
    expect(resolved.presetOverrideByMusicianId.get("bass-1")?.inputs?.add?.[0]?.key).toBe("bass_pedal");
  });

  it("falls back talkback owner to band leader for legacy projects", () => {
    const project: Project = {
      id: "p-legacy",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const resolved = resolveEffectiveProjectState({
      project,
      bandDefaultLineup: {},
      bandLeaderId: "leader-1",
    });

    expect(resolved.effectiveTalkbackOwnerId).toBe("leader-1");
  });
});
