import { describe, expect, it } from "vitest";
import type { Band, Musician, PresetEntity, Project } from "../model/types.js";
import { resolveEffectivePresetsForProject } from "./resolveEffectivePresetsForProject.js";

const band: Band = {
  id: "band-1",
  name: "Band",
  code: "b1",
  bandLeader: "leader-1",
  defaultLineup: {},
  defaultVocals: { lead: [], back: [] },
};

const repo = {
  getPreset: (id: string): PresetEntity => {
    if (id === "vocal_no_mic") {
      return {
        type: "preset",
        id,
        label: "Vocal no mic",
        group: "vocs",
        inputs: [{ key: "voc_input", label: "Vocal", group: "vocs" }],
      };
    }
    throw new Error(`Unexpected preset lookup: ${id}`);
  },
} as const;

describe("resolveEffectivePresetsForProject", () => {
  it("injects talkback only for the configured project owner", () => {
    const ownerMusician: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }],
    };
    const otherMusician: Musician = {
      id: "guitar-1",
      firstName: "Guitar",
      lastName: "Player",
      group: "guitar",
      presets: [{ kind: "preset", ref: "el_guitar" }],
    };
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { bass: ["bass-1"], guitar: ["guitar-1"] },
      overlays: { talkback: { mode: "assigned", ownerId: "bass-1" } },
    };

    const ownerItems = resolveEffectivePresetsForProject({
      project,
      band,
      musician: ownerMusician,
      group: "bass",
      repo: repo as never,
    });
    const otherItems = resolveEffectivePresetsForProject({
      project,
      band,
      musician: otherMusician,
      group: "guitar",
      repo: repo as never,
    });

    expect(ownerItems.some((item) => item.kind === "talkback")).toBe(true);
    expect(otherItems.some((item) => item.kind === "talkback")).toBe(false);
  });

  it("does not inject talkback when explicit none override is set", () => {
    const musician: Musician = {
      id: "leader-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_no_mic" }],
    };
    const project: Project = {
      id: "p-2",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: "leader-1" },
      overlays: { talkback: { mode: "none", ownerId: null } },
    };

    const items = resolveEffectivePresetsForProject({
      project,
      band,
      musician,
      group: "vocs",
      repo: repo as never,
    });

    expect(items.some((item) => item.kind === "talkback")).toBe(true);
  });

  it("keeps musician vocal capability untouched and does not synthesize role-specific vocal presets", () => {
    const musician: Musician = {
      id: "voc-1",
      firstName: "Back",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_no_mic" }],
    };
    const project: Project = {
      id: "p-3",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: "voc-1" },
      overlays: {
        leadVocals: [{ slot: 1, musicianId: "voc-1" }],
        backVocals: [{ slot: 1, musicianId: "voc-1" }],
      },
    };

    const items = resolveEffectivePresetsForProject({
      project,
      band,
      musician,
      group: "vocs",
      repo: repo as never,
    });

    expect(items.some((item) => item.kind === "preset" && item.ref === "vocal_no_mic")).toBe(true);
    expect(items.some((item) => item.kind === "talkback")).toBe(true);
  });
});
