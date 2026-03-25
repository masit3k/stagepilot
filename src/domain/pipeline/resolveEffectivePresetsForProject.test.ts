import { describe, expect, it } from "vitest";
import type { Band, Musician, Project } from "../model/types.js";
import { resolveEffectivePresetsForProject } from "./resolveEffectivePresetsForProject.js";

const band: Band = {
  id: "band-1",
  name: "Band",
  code: "b1",
  bandLeader: "leader-1",
  defaultLineup: {},
};

describe("resolveEffectivePresetsForProject", () => {
  it("returns musician capability presets without runtime talkback synthesis", () => {
    const musician: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [
        { kind: "preset", ref: "el_bass_xlr_pedalboard" },
        { kind: "talkback", ref: "talkback", ownerKey: "bass" },
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
      group: "bass",
      repo: {} as never,
    });

    expect(items).toEqual([{ kind: "preset", ref: "el_bass_xlr_pedalboard" }]);
  });
});
