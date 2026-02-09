import { describe, expect, it } from "vitest";
import type { Band, Musician, Project } from "../model/types.js";
import { resolvePowerForStageplan } from "./resolvePowerForStageplan.js";

const baseBand: Band = {
  id: "test-band",
  name: "Test Band",
  bandLeader: "musician-1",
  defaultLineup: {
    drums: "musician-1",
  },
};

const baseProject: Project = {
  id: "project-1",
  bandRef: "test-band",
  purpose: "generic",
  documentDate: "2024-01-01",
};

describe("resolvePowerForStageplan", () => {
  it("returns musician defaults when no overrides exist", () => {
    const musician: Musician = {
      id: "musician-1",
      firstName: "Alex",
      lastName: "Drummer",
      group: "drums",
      presets: [],
      requirements: {
        power: { voltage: 230, sockets: 3 },
      },
    };
    const musiciansById = new Map<string, Musician>([["musician-1", musician]]);

    const power = resolvePowerForStageplan("drums", baseBand, baseProject, musiciansById);
    expect(power).toEqual({ voltage: 230, sockets: 3 });
  });

  it("prefers project overrides over musician defaults", () => {
    const musician: Musician = {
      id: "musician-1",
      firstName: "Alex",
      lastName: "Drummer",
      group: "drums",
      presets: [],
      requirements: {
        power: { voltage: 230, sockets: 3 },
      },
    };
    const musiciansById = new Map<string, Musician>([["musician-1", musician]]);
    const project: Project = {
      ...baseProject,
      stageplan: {
        powerOverridesByMusician: {
          "musician-1": { voltage: 230, sockets: 5 },
        },
      },
    };

    const power = resolvePowerForStageplan("drums", baseBand, project, musiciansById);
    expect(power).toEqual({ voltage: 230, sockets: 5 });
  });

  it("returns null when no defaults or overrides are defined", () => {
    const musician: Musician = {
      id: "musician-1",
      firstName: "Alex",
      lastName: "Drummer",
      group: "drums",
      presets: [],
    };
    const musiciansById = new Map<string, Musician>([["musician-1", musician]]);

    const power = resolvePowerForStageplan("drums", baseBand, baseProject, musiciansById);
    expect(power).toBeNull();
  });
});
