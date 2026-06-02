import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type { Band, Musician, Project } from "../model/types.js";
import { resolveDocumentContext } from "./resolveDocumentContext.js";

describe("resolveDocumentContext", () => {
  it("passes band defaultLineup into effective context resolution", () => {
    const band: Band = {
      id: "band-1",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const bass: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [],
    };
    const project: Project = {
      id: "project-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id) => {
        if (id !== bass.id) throw new Error(`Unknown musician ${id}`);
        return bass;
      },
      getProject: () => project,
      getPreset: (id) => {
        throw new Error(`Unknown preset ${id}`);
      },
      getNotesTemplate: (id) => {
        throw new Error(`Unknown notes ${id}`);
      },
    };

    const ctx = resolveDocumentContext(project, repo);

    expect(ctx.lineup.bass).toEqual(["bass-1"]);
    expect(ctx.lineupMusicians).toEqual([{ group: "bass", musician: bass }]);
    expect(ctx.membersById.get("bass-1")).toBe(bass);
  });

  it("resolves band default talkback owner against inherited lineup", () => {
    const band: Band = {
      id: "band-1",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: ["bass-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
      defaultTalkbackOwnerId: "bass-1",
    };
    const bass: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [],
    };
    const project: Project = {
      id: "project-1",
      bandRef: "band-1",
      purpose: "generic",
      documentDate: "2026-01-01",
    };
    const repo: DataRepository = {
      getBand: () => band,
      getMusician: (id) => {
        if (id !== bass.id) throw new Error(`Unknown musician ${id}`);
        return bass;
      },
      getProject: () => project,
      getPreset: (id) => {
        throw new Error(`Unknown preset ${id}`);
      },
      getNotesTemplate: (id) => {
        throw new Error(`Unknown notes ${id}`);
      },
    };

    const ctx = resolveDocumentContext(project, repo);

    expect(ctx.talkbackOwnerId).toBe("bass-1");
  });
});
