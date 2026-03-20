import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type { Band, Musician, NotesTemplate, PresetEntity, Project } from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

const notesTemplate: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

function createRepo(args: {
  band: Band;
  musicians: Record<string, Musician>;
  presets: Record<string, PresetEntity>;
  project: Project;
}): DataRepository {
  return {
    getBand: () => args.band,
    getMusician: (id: string) => {
      const musician = args.musicians[id];
      if (!musician) throw new Error(`Unknown musician ${id}`);
      return musician;
    },
    getProject: () => args.project,
    getPreset: (id: string) => {
      const preset = args.presets[id];
      if (!preset) throw new Error(`Unknown preset ${id}`);
      return preset;
    },
    getNotesTemplate: () => notesTemplate,
  };
}

describe("buildDocument vocal overlay composition", () => {
  it("keeps monitor/stageplan cardinality lineup-based while applying unified lead/back labels", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: {
        guitar: ["gtr-1"],
        bass: ["bass-1"],
        drums: ["drm-1"],
        vocs: ["voc-1"],
      },
      defaultVocals: { lead: [], back: [] },
    };

    const musicians: Record<string, Musician> = {
      "gtr-1": {
        id: "gtr-1",
        firstName: "Guitar",
        lastName: "Player",
        gender: "m",
        group: "guitar",
        presets: [{ kind: "preset", ref: "el_guitar" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "Player",
        gender: "m",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "vocal", ref: "vocal_lead_no_mic", ownerKey: "bass", ownerLabel: "bass" },
          { kind: "monitor", ref: "iem_stereo_wireless" },
        ],
      },
      "drm-1": {
        id: "drm-1",
        firstName: "Drummer",
        lastName: "Player",
        gender: "m",
        group: "drums",
        presets: [{ kind: "preset", ref: "drums_basic" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "voc-1": {
        id: "voc-1",
        firstName: "Vocal",
        lastName: "Player",
        gender: "f",
        group: "vocs",
        presets: [
          { kind: "vocal", ref: "vocal_lead_no_mic", ownerKey: "vocs", ownerLabel: "vocs" },
          { kind: "monitor", ref: "wedge" },
        ],
      },
    };

    const project: Project = {
      id: "project",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: band.defaultLineup,
      overlays: {
        leadVocals: [{ musicianId: "bass-1" }, { musicianId: "voc-1" }],
        backVocals: [{ musicianId: "gtr-1" }, { musicianId: "voc-1" }],
        talkback: { mode: "assigned", ownerId: "bass-1" },
      },
    };

    const presets: Record<string, PresetEntity> = {
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Electric guitar",
        group: "guitar",
        inputs: [{ key: "el_guitar", label: "Electric guitar", group: "guitar" }],
      },
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      },
      drums_basic: {
        type: "preset",
        id: "drums_basic",
        label: "Drums",
        group: "drums",
        inputs: [{ key: "dr_oh_l", label: "OH L", group: "drums" }],
      },
      vocal_lead_no_mic: {
        type: "vocal_type",
        id: "vocal_lead_no_mic",
        label: "Lead vocal no mic",
        group: "vocs",
        input: { key: "voc_lead_1", label: "Lead vocal" },
      },
      vocal_back_no_mic: {
        type: "vocal_type",
        id: "vocal_back_no_mic",
        label: "Back vocal no mic",
        group: "vocs",
        input: { key: "voc_back_{ownerKey}", label: "Back vocal ({ownerLabel})" },
      },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: { key: "tb_{ownerKey}", label: "Talkback - {ownerLabel}" },
      },
      wedge: { type: "monitor", id: "wedge", label: "Wedge monitor" },
      iem_stereo_wireless: { type: "monitor", id: "iem_stereo_wireless", label: "IEM STEREO wireless" },
    };

    const vm = buildDocument(project, createRepo({ band, musicians, presets, project }));

    const monitorOutputs = vm.stageplan.monitorOutputs.map((row) => row.output);
    expect(monitorOutputs).toEqual(["Drums", "Bass", "Guitar", "Lead vocal 2 (female)"]);
    expect(vm.stageplan.monitorOutputs).toHaveLength(4);

    const stageplanPersonCount =
      ["drums", "bass", "guitar", "keys"]
        .map((role) => vm.stageplan.lineupByRole[role as "drums" | "bass" | "guitar" | "keys"])
        .filter(Boolean).length + vm.stageplan.leadVocals.length;
    expect(stageplanPersonCount).toBe(4);

    expect(vm.inputs.some((input) => input.label === "Lead vocal 1 (bass)")).toBe(true);
    expect(vm.inputs.some((input) => input.label === "Lead vocal 2 (female)")).toBe(true);
    expect(vm.inputs.some((input) => input.label === "Back vocal 1 (guitar)")).toBe(true);
    expect(vm.inputs.some((input) => input.label === "Back vocal 2 (female)")).toBe(true);
    expect(vm.inputs.some((input) => input.label === "Talkback (bass)")).toBe(true);
    expect(vm.inputs.some((input) => input.label === "Talkback - bass")).toBe(false);
  });
});
