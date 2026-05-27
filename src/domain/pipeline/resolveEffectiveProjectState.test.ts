import { describe, expect, it } from "vitest";
import type { Project } from "../model/types.js";
import { resolveEffectiveProjectState } from "./resolveEffectiveProjectState.js";

describe("resolveEffectiveProjectState", () => {
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
