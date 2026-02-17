import { describe, expect, it } from "vitest";
import { buildDocument } from "./buildDocument.js";
import type { Band, Musician, NotesTemplate, Preset, Project } from "../model/types.js";
import type { DataRepository } from "../../infra/fs/repo.js";

describe("buildDocument setup overrides", () => {
  it("uses lineup presetOverride monitoring in monitor table", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "bass-1",
      defaultLineup: { bass: "bass-1" },
    };
    const musician: Musician = {
      id: "bass-1",
      firstName: "Bass",
      lastName: "Player",
      group: "bass",
      presets: [
        { kind: "preset", ref: "el_bass_xlr_pedalboard" },
      ],
    };
    const bassPreset: Preset = {
      type: "preset",
      id: "el_bass_xlr_pedalboard",
      label: "Electric bass guitar",
      group: "bass",
      inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
    };

    const talkbackPreset = {
      type: "talkback_type",
      id: "talkback",
      label: "Talkback",
      group: "talkback",
      input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
    } as const;

    const notes: NotesTemplate = {
      id: "notes_default_cs",
      lang: "cs",
      inputs: [],
      monitors: [],
    };
    const project: Project = {
      id: "p1",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        bass: {
          musicianId: "bass-1",
          presetOverride: { monitoring: { type: "iem_wired" } },
        },
      },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => musician,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "el_bass_xlr_pedalboard") return bassPreset;
        if (id === "talkback") return talkbackPreset;
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(vm.stageplan.monitorOutputs.some((row) => row.note === "IEM (wired)")).toBe(true);
    expect(vm.inputs.filter((item) => item.key === "el_bass_xlr_pedalboard")).toHaveLength(1);
  });
});
