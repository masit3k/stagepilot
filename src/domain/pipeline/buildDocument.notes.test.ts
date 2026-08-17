import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Musician,
  NotesTemplate,
  Preset,
  Project,
} from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

const band: Band = {
  id: "band",
  name: "Band",
  bandLeader: "bass-1",
  defaultLineup: { bass: ["bass-1"] },
  defaultOverlays: { leadVocals: [], backVocals: [] },
};

const musician: Musician = {
  id: "bass-1",
  firstName: "Bass",
  lastName: "Player",
  group: "bass",
  presets: [{ kind: "preset", ref: "bass_rig" }],
};

const preset: Preset = {
  type: "preset",
  id: "bass_rig",
  label: "Bass rig",
  group: "bass",
  inputs: [{ key: "bass_di", label: "Bass DI", group: "bass" }],
};

const notes: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  version: 1,
  inputs: [
    { id: "no_foh_engineer", text: "Kapela NEMÁ vlastního zvukaře." },
    { id: "drum_riser_required", text: "Drum riser 3 × 2 m." },
  ],
  monitors: [{ id: "console_access", text: "Přístup do pultu." }],
};

function makeProject(extra: Partial<Project> = {}): Project {
  return {
    id: "p1",
    bandRef: "band",
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: { bass: { musicianId: "bass-1" } },
    ...extra,
  } as Project;
}

function build(extra: Partial<Project> = {}) {
  const project = makeProject(extra);
  const repo = {
    getBand: () => band,
    getMusician: () => musician,
    getProject: () => project,
    getPreset: (id: string) => {
      if (id === "bass_rig") return preset;
      if (id === "wedge_foh") {
        return {
          type: "monitor",
          id,
          label: "Wedge",
          kind: "wedge",
          supplier: "foh",
        };
      }
      throw new Error(`unknown preset ${id}`);
    },
    getNotesTemplate: () => notes,
  } as DataRepository;

  return buildDocument(project, repo);
}

describe("buildDocument notes deviations", () => {
  it("prints the whole band template when the project deviates in nothing", () => {
    const vm = build();

    expect(vm.notes.inputs.map((note) => note.id)).toEqual([
      "no_foh_engineer",
      "drum_riser_required",
    ]);
    expect(vm.notes.monitors.map((note) => note.id)).toEqual([
      "console_access",
    ]);
  });

  it("drops a note the project disabled", () => {
    const vm = build({ notes: { disabled: ["drum_riser_required"] } });

    expect(vm.notes.inputs.map((note) => note.id)).toEqual(["no_foh_engineer"]);
  });

  it("prints the project text instead of the template text", () => {
    const vm = build({
      notes: { overrides: { drum_riser_required: "Drum riser 2 × 2 m." } },
    });

    expect(
      vm.notes.inputs.find((note) => note.id === "drum_riser_required")?.text,
    ).toBe("Drum riser 2 × 2 m.");
  });

  it("prints a custom note at the end of its own section", () => {
    const vm = build({
      notes: {
        custom: [
          { id: "custom_1", section: "inputs", text: "Naše vstupní věta." },
          {
            id: "custom_2",
            section: "monitors",
            text: "Naše monitorová věta.",
          },
        ],
      },
    });

    expect(vm.notes.inputs.at(-1)).toEqual({
      id: "custom_1",
      text: "Naše vstupní věta.",
    });
    expect(vm.notes.monitors.at(-1)).toEqual({
      id: "custom_2",
      text: "Naše monitorová věta.",
    });
  });
});
