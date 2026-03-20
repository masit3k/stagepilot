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
    if (id === "vocal_back_no_mic") {
      return {
        type: "vocal_type",
        id,
        label: "Back vocal no mic",
        group: "vocs",
        input: {
          key: "voc_back_{ownerKey}",
          label: "Back vocal - {ownerLabel}",
        },
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
      presets: [{ kind: "preset", ref: "vocal_lead" }],
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

    expect(items.some((item) => item.kind === "talkback")).toBe(false);
  });

  it("removes legacy talkback presets from musician defaults", () => {
    const musician: Musician = {
      id: "leader-1",
      firstName: "Lead",
      lastName: "Singer",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead" },
        { kind: "talkback", ref: "talkback", ownerKey: "vocs" },
      ],
    };
    const project: Project = {
      id: "p-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };

    const items = resolveEffectivePresetsForProject({
      project,
      band,
      musician,
      group: "vocs",
      repo: repo as never,
    });

    expect(items.filter((item) => item.kind === "talkback")).toHaveLength(1);
  });

  it("does not rehydrate default back vocals when explicit empty override is present", () => {
    const musician: Musician = {
      id: "voc-1",
      firstName: "Back",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "vocal", ref: "vocal_back_no_mic", ownerKey: "vocs" }],
    };
    const project: Project = {
      id: "p-3",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: "voc-1" },
      overlays: { backVocals: [] },
    };

    const items = resolveEffectivePresetsForProject({
      project,
      band,
      musician,
      group: "vocs",
      repo: repo as never,
    });

    expect(
      items.some(
        (item) =>
          item.kind === "vocal" &&
          "ref" in item &&
          item.ref.startsWith("vocal_back_"),
      ),
    ).toBe(false);
  });

  it("does not include musician back vocal defaults when project has no explicit overlays.backVocals", () => {
    const musician: Musician = {
      id: "voc-1",
      firstName: "Back",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "vocal", ref: "vocal_back_no_mic", ownerKey: "vocs" }],
    };
    const project: Project = {
      id: "p-4",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: "voc-1" },
    };

    const items = resolveEffectivePresetsForProject({
      project,
      band,
      musician,
      group: "vocs",
      repo: repo as never,
    });

    expect(
      items.some(
        (item) =>
          item.kind === "vocal" &&
          "ref" in item &&
          item.ref.startsWith("vocal_back_"),
      ),
    ).toBe(false);
  });

  it("uses only explicit project overlays.backVocals selection for back vocal presets", () => {
    const selectedBackSinger: Musician = {
      id: "voc-1",
      firstName: "Selected",
      lastName: "Back",
      group: "vocs",
      presets: [{ kind: "vocal", ref: "vocal_back_no_mic", ownerKey: "vocs" }],
    };
    const nonSelectedBackSinger: Musician = {
      id: "voc-2",
      firstName: "NonSelected",
      lastName: "Back",
      group: "vocs",
      presets: [{ kind: "vocal", ref: "vocal_back_no_mic", ownerKey: "vocs" }],
    };
    const project: Project = {
      id: "p-5",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
      lineup: { vocs: ["voc-1", "voc-2"] },
      overlays: { backVocals: [{ slot: 1, musicianId: "voc-1" }] },
    };

    const selectedItems = resolveEffectivePresetsForProject({
      project,
      band,
      musician: selectedBackSinger,
      group: "vocs",
      repo: repo as never,
    });
    const nonSelectedItems = resolveEffectivePresetsForProject({
      project,
      band,
      musician: nonSelectedBackSinger,
      group: "vocs",
      repo: repo as never,
    });

    expect(
      selectedItems.some(
        (item) =>
          item.kind === "vocal" &&
          "ref" in item &&
          item.ref.startsWith("vocal_back_"),
      ),
    ).toBe(true);
    expect(
      nonSelectedItems.some(
        (item) =>
          item.kind === "vocal" &&
          "ref" in item &&
          item.ref.startsWith("vocal_back_"),
      ),
    ).toBe(false);
  });
});
