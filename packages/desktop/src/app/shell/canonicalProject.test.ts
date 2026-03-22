import { describe, expect, it } from "vitest";
import {
  buildCanonicalOverlaysFromDefaults,
  buildCanonicalProjectBaseFromBandDefaults,
  buildCanonicalProjectFromSetupState,
} from "./canonicalProject";

describe("buildCanonicalOverlaysFromDefaults", () => {
  it("seeds lineup-scoped lead/back/talkback overlays", () => {
    const overlays = buildCanonicalOverlaysFromDefaults({
      setupDefaults: {
        id: "band-1",
        name: "Band",
        defaultOverlays: {
          leadVocals: [
            { slot: 7, musicianId: "voc-1" },
            { slot: 8, musicianId: "off-lineup" },
          ],
          backVocals: [{ slot: 3, musicianId: "voc-2" }],
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

describe("buildCanonicalProjectBaseFromBandDefaults", () => {
  it("materializes full canonical defaults for initial event/generic save", () => {
    const payload = buildCanonicalProjectBaseFromBandDefaults({
      project: {
        id: "proj-1",
        purpose: "generic",
        bandRef: "band-1",
        documentDate: "2026-03-22",
        createdAt: "2026-03-22T10:00:00.000Z",
      },
      setupDefaults: {
        id: "band-1",
        name: "Band",
        bandLeaderId: "leader-1",
        defaultTalkbackOwnerId: "tb-1",
        defaultLineup: { drums: "dr-1", vocs: ["voc-1"] },
        defaultOverlays: {
          leadVocals: [{ slot: 1, musicianId: "voc-1" }],
          backVocals: [],
        },
        members: {},
      },
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
    });

    expect(payload.bandLeaderId).toBe("leader-1");
    expect(payload.lineup).toEqual({ drums: ["dr-1"], vocs: ["voc-1"] });
    expect(payload.overlays).toEqual({
      leadVocals: [{ slot: 1, musicianId: "voc-1" }],
      backVocals: [],
      talkback: { mode: "assigned", ownerId: "tb-1" },
    });
  });
});

describe("buildCanonicalProjectFromSetupState", () => {
  it("keeps talkback implicit when no explicit talkback override exists", () => {
    const project = buildCanonicalProjectFromSetupState({
      project: {
        id: "proj-default-talkback",
        purpose: "generic",
        bandRef: "band-1",
        documentDate: "2026-03-21",
        createdAt: "2026-03-21T00:00:00.000Z",
      },
      roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
      lineup: {
        drums: "dr-1",
        vocs: ["vc-1"],
      },
      bandLeaderId: "dr-1",
      talkbackOwnerId: "dr-1",
      hasTalkbackOverride: false,
      leadVocalistIds: [],
      hasLeadVocalOverride: false,
      backVocalIds: [],
      hasBackVocalOverride: false,
    });

    expect(project.overlays?.talkback).toBeUndefined();
  });

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
  });
});
