import { describe, expect, it } from "vitest";
import type { Project } from "../model/types.js";
import { resolveEffectiveTalkbackAssignment } from "./resolveEffectiveTalkbackAssignment.js";

describe("resolveEffectiveTalkbackAssignment", () => {
  it("falls back to band leader when no override exists", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const result = resolveEffectiveTalkbackAssignment({
      project,
      bandLeaderId: "leader-1",
      selectedMusicianIds: ["leader-1", "bass-1"],
    });

    expect(result).toEqual({ mode: "assigned", musicianId: "leader-1", hasExplicitOverride: false });
  });

  it("treats explicit none as no assignment", () => {
    const project: Project = {
      id: "p-2",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      talkbackOverride: { mode: "none" },
    };

    const result = resolveEffectiveTalkbackAssignment({
      project,
      bandLeaderId: "leader-1",
      selectedMusicianIds: ["leader-1", "bass-1"],
    });

    expect(result).toEqual({ mode: "none", hasExplicitOverride: true });
  });
});
