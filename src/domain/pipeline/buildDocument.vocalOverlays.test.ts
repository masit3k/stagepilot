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
    expect(monitorOutputs).toEqual(["Guitar", "Lead vocal 2 (female)", "Bass", "Drums"]);
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

  it("renders monitor owners in business order and keeps all resolved lead owners in input rows", () => {
    const band: Band = {
      id: "band-2",
      name: "Band",
      bandLeader: "voc-1",
      defaultLineup: {
        drums: ["drm-1"],
        bass: ["bass-1"],
        guitar: ["gtr-1"],
        keys: ["keys-1"],
        vocs: ["voc-1", "voc-2"],
      },
      defaultVocals: { lead: [], back: [] },
    };

    const musicians: Record<string, Musician> = {
      "drm-1": {
        id: "drm-1",
        firstName: "Drummer",
        lastName: "Player",
        gender: "m",
        group: "drums",
        presets: [{ kind: "preset", ref: "drums_basic" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "Player",
        gender: "m",
        group: "bass",
        presets: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "gtr-1": {
        id: "gtr-1",
        firstName: "Guitar",
        lastName: "Player",
        gender: "m",
        group: "guitar",
        presets: [{ kind: "preset", ref: "el_guitar" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "keys-1": {
        id: "keys-1",
        firstName: "Keys",
        lastName: "Player",
        gender: "f",
        group: "keys",
        presets: [{ kind: "preset", ref: "keys_stereo" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "voc-1": {
        id: "voc-1",
        firstName: "Lead",
        lastName: "Singer",
        gender: "f",
        group: "vocs",
        presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }, { kind: "monitor", ref: "wedge" }],
      },
      "voc-2": {
        id: "voc-2",
        firstName: "Back",
        lastName: "Singer",
        gender: "m",
        group: "vocs",
        presets: [{ kind: "monitor", ref: "wedge" }],
      },
    };

    const project: Project = {
      id: "project-2",
      bandRef: "band-2",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: band.defaultLineup,
      overlays: {
        leadVocals: [
          { slot: 1, musicianId: "bass-1" },
          { slot: 2, musicianId: "voc-1" },
          { slot: 3, musicianId: "drm-1" },
          { slot: 4, musicianId: "voc-2" },
        ],
        backVocals: [{ slot: 1, musicianId: "gtr-1" }],
      },
    };

    const presets: Record<string, PresetEntity> = {
      drums_basic: {
        type: "preset",
        id: "drums_basic",
        label: "Drums",
        group: "drums",
        inputs: [{ key: "dr_oh_l", label: "OH L", group: "drums" }],
      },
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      },
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Electric guitar",
        group: "guitar",
        inputs: [{ key: "el_guitar", label: "Electric guitar", group: "guitar" }],
      },
      keys_stereo: {
        type: "preset",
        id: "keys_stereo",
        label: "Keys stereo",
        group: "keys",
        inputs: [
          { key: "keys_l", label: "Keys L", group: "keys" },
          { key: "keys_r", label: "Keys R", group: "keys" },
        ],
      },
      vocal_lead_no_mic: {
        type: "preset",
        id: "vocal_lead_no_mic",
        label: "Lead vocal no mic",
        group: "vocs",
        inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
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
    expect(vm.stageplan.monitorOutputs.map((row) => row.output)).toEqual([
      "Guitar",
      "Lead vocal 2 (female)",
      "Lead vocal 4 (male)",
      "Keys",
      "Bass",
      "Drums",
    ]);
    expect(vm.stageplan.monitorOutputs).toHaveLength(6);

    const leadRows = vm.inputRows.filter((row) => row.label.startsWith("Lead vocal "));
    expect(leadRows).toHaveLength(4);
    expect(leadRows.some((row) => row.label === "Lead vocal 1 (bass)")).toBe(true);
    expect(leadRows.some((row) => row.label === "Lead vocal 2 (female)")).toBe(true);
    expect(leadRows.some((row) => row.label === "Lead vocal 3 (drums)")).toBe(true);
    expect(leadRows.some((row) => row.label === "Lead vocal 4 (male)")).toBe(true);

    const stageplanPersonCount =
      ["drums", "bass", "guitar", "keys"]
        .map((role) => vm.stageplan.lineupByRole[role as "drums" | "bass" | "guitar" | "keys"])
        .filter(Boolean).length + vm.stageplan.leadVocals.length;
    expect(stageplanPersonCount).toBe(6);
  });

  it("moves vocals to an end block, keeps talkback last, and keeps drummer lead vocal attached to drums in stageplan", () => {
    const band: Band = {
      id: "band-3",
      name: "Band",
      bandLeader: "voc-f",
      defaultLineup: {
        guitar: ["gtr-1"],
        keys: ["keys-1"],
        bass: ["bass-1"],
        drums: ["drm-1"],
        vocs: ["voc-m", "voc-f"],
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
      "keys-1": {
        id: "keys-1",
        firstName: "Keys",
        lastName: "Player",
        gender: "f",
        group: "keys",
        presets: [{ kind: "preset", ref: "keys_stereo" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Bass",
        lastName: "Player",
        gender: "m",
        group: "bass",
        presets: [{ kind: "preset", ref: "el_bass_xlr_pedalboard" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "drm-1": {
        id: "drm-1",
        firstName: "Drummer",
        lastName: "Player",
        gender: "m",
        group: "drums",
        presets: [{ kind: "preset", ref: "drums_basic" }, { kind: "monitor", ref: "iem_stereo_wireless" }],
      },
      "voc-m": {
        id: "voc-m",
        firstName: "Male",
        lastName: "Singer",
        gender: "m",
        group: "vocs",
        presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }, { kind: "monitor", ref: "wedge" }],
      },
      "voc-f": {
        id: "voc-f",
        firstName: "Female",
        lastName: "Singer",
        gender: "f",
        group: "vocs",
        presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }, { kind: "monitor", ref: "wedge" }],
      },
    };

    const project: Project = {
      id: "project-3",
      bandRef: "band-3",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: band.defaultLineup,
      overlays: {
        leadVocals: [
          { slot: 1, musicianId: "voc-m" },
          { slot: 2, musicianId: "voc-f" },
          { slot: 3, musicianId: "bass-1" },
          { slot: 4, musicianId: "drm-1" },
        ],
        backVocals: [{ slot: 1, musicianId: "gtr-1" }],
        talkback: { mode: "assigned", ownerId: "bass-1" },
      },
    };

    const presets: Record<string, PresetEntity> = {
      drums_basic: {
        type: "preset",
        id: "drums_basic",
        label: "Drums",
        group: "drums",
        inputs: [{ key: "dr_kick_in", label: "Kick IN", group: "drums" }],
      },
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      },
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Electric guitar",
        group: "guitar",
        inputs: [{ key: "el_guitar", label: "Electric guitar", group: "guitar" }],
      },
      keys_stereo: {
        type: "preset",
        id: "keys_stereo",
        label: "Keys stereo",
        group: "keys",
        inputs: [{ key: "keys", label: "Keys", group: "keys" }],
      },
      vocal_lead_no_mic: {
        type: "preset",
        id: "vocal_lead_no_mic",
        label: "Lead vocal no mic",
        group: "vocs",
        inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
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
    const labels = vm.inputRows.map((row) => row.label);
    const vocals = labels.filter((label) => label.includes("vocal"));
    expect(vocals).toEqual([
      "Back vocal 1 (guitar)",
      "Lead vocal 1 (male)",
      "Lead vocal 2 (female)",
      "Lead vocal 3 (bass)",
      "Lead vocal 4 (drums)",
    ]);
    expect(labels.at(-1)).toBe("Talkback (bass)");

    const firstVocalIndex = labels.findIndex((label) => label.includes("vocal"));
    const lastVocalIndex = labels.reduce((index, label, current) => (
      label.includes("vocal") ? current : index
    ), -1);
    expect(firstVocalIndex).toBeGreaterThan(0);
    expect(labels.slice(0, firstVocalIndex).some((label) => label.includes("vocal"))).toBe(false);
    expect(labels.slice(firstVocalIndex, lastVocalIndex + 1).every((label) => label.includes("vocal"))).toBe(true);

    expect(vm.stageplan.inputs.some((input) => (
      input.ownerRole === "drums" && input.label === "Lead vocal 4 (drums)"
    ))).toBe(true);

    const stageplanPersonCount =
      ["drums", "bass", "guitar", "keys"]
        .map((role) => vm.stageplan.lineupByRole[role as "drums" | "bass" | "guitar" | "keys"])
        .filter(Boolean).length + vm.stageplan.leadVocals.length;
    expect(stageplanPersonCount).toBe(6);
    expect(vm.stageplan.monitorOutputs).toHaveLength(6);
  });
});
