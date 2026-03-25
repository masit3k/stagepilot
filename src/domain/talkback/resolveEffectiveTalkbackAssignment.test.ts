import { describe, expect, it } from "vitest";
import type { Project } from "../model/types.js";
import { resolveEffectiveTalkbackAssignment } from "./resolveEffectiveTalkbackAssignment.js";

describe("resolveEffectiveTalkbackAssignment", () => {
  it("returns none when no canonical talkback overlay exists", () => {
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { bass: ["bass-1"] },
    };

    expect(resolveEffectiveTalkbackAssignment({ project })).toEqual({
      mode: "none",
      hasExplicitOverride: false,
    });
  });

  it("returns assigned talkback only for explicit valid overlay owner", () => {
    const project: Project = {
      id: "p-2",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { bass: ["bass-1"] },
      overlays: { talkback: { mode: "assigned", ownerId: "bass-1" } },
    };

    expect(resolveEffectiveTalkbackAssignment({ project })).toEqual({
      mode: "assigned",
      musicianId: "bass-1",
      hasExplicitOverride: true,
    });
  });

  it("fails closed for invalid assigned owner", () => {
    const project: Project = {
      id: "p-3",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { bass: ["bass-1"] },
      overlays: { talkback: { mode: "assigned", ownerId: "ghost" } },
    };

    expect(resolveEffectiveTalkbackAssignment({ project })).toEqual({
      mode: "none",
      hasExplicitOverride: true,
    });
  });
});
