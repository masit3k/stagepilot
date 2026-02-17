import { describe, expect, it } from "vitest";
import { buildDocument } from "./buildDocument.js";
import type { Band, Musician, NotesTemplate, Preset, Project } from "../model/types.js";
import type { DataRepository } from "../../infra/fs/repo.js";

describe("buildDocument setup overrides", () => {
  it("uses lineup monitoring + input overrides in monitor table and stageplan", () => {
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
        { kind: "monitor", ref: "iem_stereo_wireless" },
      ],
    };
    const bassPreset: Preset = {
      type: "preset",
      id: "el_bass_xlr_pedalboard",
      label: "Electric bass guitar",
      group: "bass",
      inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
    };

    const notes: NotesTemplate = { id: "notes_default_cs", lang: "cs", inputs: [], monitors: [] };
    const project: Project = {
      id: "p1",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        bass: {
          musicianId: "bass-1",
          presetOverride: {
            monitoring: { monitorRef: "iem_stereo_wired", additionalWedgeCount: 2 },
            inputs: {
              replace: [{
                targetKey: "el_bass_xlr_pedalboard",
                with: { key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" },
              }],
            },
          },
        },
      },
    };

    const repo: DataRepository = {
      getBand: () => band,
      getMusician: () => musician,
      getProject: () => project,
      getPreset: (id: string) => {
        if (id === "el_bass_xlr_pedalboard") return bassPreset;
        if (id === "iem_stereo_wireless") return { type: "monitor", id, label: "IEM STEREO wireless" };
        if (id === "iem_stereo_wired") return { type: "monitor", id, label: "IEM STEREO wired" };
        if (id === "talkback") return {
          type: "talkback_type",
          id: "talkback",
          label: "Talkback",
          group: "talkback",
          input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
        };
        throw new Error(`unknown preset ${id}`);
      },
      getNotesTemplate: () => notes,
    };

    const vm = buildDocument(project, repo);
    expect(vm.stageplan.monitorOutputs.some((row) => row.note === "IEM STEREO wired + Additional wedge x2")).toBe(true);
    expect(vm.inputs.some((item) => item.key === "el_bass_xlr_amp")).toBe(true);
    expect(vm.inputs.some((item) => item.key === "el_bass_xlr_pedalboard")).toBe(false);
  });
});
