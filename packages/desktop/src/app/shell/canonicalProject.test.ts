import { describe, expect, it } from "vitest";
import {
  buildCanonicalOverlaysFromDefaults,
  buildCanonicalProjectFromSetupState,
} from "./canonicalProject";

describe("buildCanonicalOverlaysFromDefaults", () => {
  it("seeds lineup-scoped lead/back/talkback overlays", () => {
    const overlays = buildCanonicalOverlaysFromDefaults({
      setupDefaults: {
        id: "band-1",
        name: "Band",
        defaultOverlays: {
          leadVocals: ["voc-1", "off-lineup"],
          backVocals: ["voc-2"],
        },
        members: {},
      },
      lineup: { vocs: ["voc-1", "voc-2"] },
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      talkbackOwnerId: "voc-1",
    });

    expect(overlays).toEqual({
      leadVocals: [{ slot: 1, musicianId: "voc-1" }],
      backVocals: [{ slot: 1, musicianId: "voc-2" }],
      talkback: { mode: "assigned", ownerId: "voc-1" },
    });
  });
});

describe("buildCanonicalProjectFromSetupState", () => {
  it("stores lineup as canonical arrays and explicit talkback none overlay", () => {
    const project = buildCanonicalProjectFromSetupState({
      project: {
        id: "proj-1",
        purpose: "event",
        bandRef: "band-1",
        documentDate: "2026-03-21",
        createdAt: "2026-03-21T00:00:00.000Z",
      },
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      lineup: {
        drums: "dr-1",
        bass: "ba-1",
        guitar: "gt-1",
        keys: "ky-1",
        vocs: ["vc-1"],
      },
      bandLeaderId: "dr-1",
      talkbackOwnerId: "",
      hasTalkbackOverride: true,
      leadVocalistIds: ["vc-1"],
      hasLeadVocalOverride: true,
      backVocalIds: [],
      hasBackVocalOverride: true,
    });

    expect(project.lineup).toEqual({
      drums: ["dr-1"],
      bass: ["ba-1"],
      guitar: ["gt-1"],
      keys: ["ky-1"],
      vocs: ["vc-1"],
    });
    expect(project.overlays).toEqual({
      leadVocals: [{ slot: 1, musicianId: "vc-1" }],
      backVocals: [],
      talkback: { mode: "none", ownerId: null },
    });
    expect(project.talkbackOwnerId).toBe("");
  });
});
