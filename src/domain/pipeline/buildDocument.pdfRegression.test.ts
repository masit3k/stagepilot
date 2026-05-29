import { describe, expect, it } from "vitest";
import { normalizeProject } from "../../app/usecases/normalizeProject.js";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Musician,
  NotesTemplate,
  PresetEntity,
  Project,
  ProjectJsonV2,
} from "../model/types.js";
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
    getBand: (id: string) => {
      if (id !== args.band.id) throw new Error(`Unknown band ${id}`);
      return args.band;
    },
    getMusician: (id: string) => {
      const musician = args.musicians[id];
      if (!musician) throw new Error(`Unknown musician ${id}`);
      return musician;
    },
    getProject: (id: string) => {
      if (id !== args.project.id) throw new Error(`Unknown project ${id}`);
      return args.project;
    },
    getPreset: (id: string) => {
      const preset = args.presets[id];
      if (!preset) throw new Error(`Unknown preset ${id}`);
      return preset;
    },
    getNotesTemplate: (id: string) => {
      if (id !== notesTemplate.id) throw new Error(`Unknown notes ${id}`);
      return notesTemplate;
    },
  };
}

function pickRows(
  rows: Array<{ no: string; label: string; note?: string }>,
): Array<{ no: string; label: string; note?: string }> {
  return rows.map(({ no, label, note }) => ({ no, label, note }));
}

describe("buildDocument PDF regression model", () => {
  it("freezes current full-lineup document model ordering, numbering, labels, and stageplan data", () => {
    const band: Band = {
      id: "band-pdf-regression",
      name: "PDF Regression Band",
      bandLeader: "voc-f",
      defaultLineup: {
        drums: ["drm-1"],
        bass: ["bass-1"],
        guitar: ["gtr-1"],
        keys: ["keys-1"],
        vocs: ["voc-f", "voc-m"],
      },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };

    const musicians: Record<string, Musician> = {
      "drm-1": {
        id: "drm-1",
        firstName: "Dana",
        lastName: "Drummer",
        gender: "f",
        group: "drums",
        presets: [
          {
            kind: "drum_setup",
            setup: {
              kickCount: 1,
              kicks: [{ in: true, out: true }],
              snareCount: 1,
              snares: [{ top: true, bottom: true }],
              hasHiHat: true,
              tomCount: 2,
              floorCount: 1,
              hasOverheads: true,
              pad: { enabled: true, mode: "sfx", channels: "mono" },
              tracks: { enabled: true },
            },
          },
          { kind: "monitor", ref: "iem_stereo_wireless" },
        ],
      },
      "bass-1": {
        id: "bass-1",
        firstName: "Ben",
        lastName: "Bass",
        gender: "m",
        group: "bass",
        presets: [
          { kind: "preset", ref: "el_bass_xlr_pedalboard" },
          { kind: "monitor", ref: "iem_stereo_wireless" },
        ],
      },
      "gtr-1": {
        id: "gtr-1",
        firstName: "Gina",
        lastName: "Guitar",
        gender: "f",
        group: "guitar",
        presets: [
          { kind: "preset", ref: "el_guitar" },
          { kind: "preset", ref: "vocal_back_no_mic" },
          { kind: "monitor", ref: "iem_stereo_wireless" },
        ],
      },
      "keys-1": {
        id: "keys-1",
        firstName: "Kira",
        lastName: "Keys",
        gender: "f",
        group: "keys",
        presets: [
          { kind: "preset", ref: "keys_stereo_xlr" },
          { kind: "preset", ref: "vocal_lead_no_mic" },
          { kind: "monitor", ref: "iem_stereo_wireless" },
        ],
        requirements: { power: { voltage: 230, sockets: 2 } },
      },
      "voc-f": {
        id: "voc-f",
        firstName: "Vera",
        lastName: "Vocal",
        gender: "f",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_wireless" },
          { kind: "monitor", ref: "wedge" },
        ],
      },
      "voc-m": {
        id: "voc-m",
        firstName: "Marek",
        lastName: "Vocal",
        gender: "m",
        group: "vocs",
        presets: [
          { kind: "preset", ref: "vocal_wired" },
          { kind: "monitor", ref: "wedge" },
        ],
      },
    };

    const projectJson: ProjectJsonV2 = {
      id: "project-pdf-regression",
      bandRef: band.id,
      purpose: "event",
      eventDate: "2026-06-20",
      eventVenue: "Regression Hall",
      documentDate: "2026-05-29",
      lineup: {
        drums: ["drm-1"],
        bass: [
          {
            musicianId: "bass-1",
            presetOverride: {
              monitoring: {
                monitorRef: "wedge",
                additionalWedgeCount: 1,
              },
            },
          },
        ],
        guitar: ["gtr-1"],
        keys: ["keys-1"],
        vocs: ["voc-f", "voc-m"],
      },
      overlays: {
        leadVocals: ["voc-f", "keys-1", "voc-m"],
        backVocals: ["gtr-1"],
        talkback: { mode: "assigned", ownerId: "bass-1" },
      },
      stageplan: {
        powerOverridesByMusician: {
          "gtr-1": { voltage: 230, sockets: 4 },
        },
      },
    };
    const project = normalizeProject(projectJson);

    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        setupGroup: "electric_bass",
        presetRole: "primary",
        inputs: [
          {
            key: "el_bass_xlr_pedalboard",
            label: "Electric bass guitar",
            group: "bass",
            note: "XLR out from pedalboard",
          },
        ],
      },
      el_guitar: {
        type: "preset",
        id: "el_guitar",
        label: "Electric guitar",
        group: "guitar",
        inputs: [
          {
            key: "el_guitar",
            label: "Electric guitar",
            group: "guitar",
            note: "XLR out from pedalboard",
          },
        ],
      },
      keys_stereo_xlr: {
        type: "preset",
        id: "keys_stereo_xlr",
        label: "Keys stereo XLR",
        group: "keys",
        inputs: [
          {
            key: "keys_l",
            label: "Keys L",
            baseLabel: "Keys",
            compactGroupKey: "keys_main",
            channel: "L",
            group: "keys",
            note: "XLR out from keys rig",
          },
          {
            key: "keys_r",
            label: "Keys R",
            baseLabel: "Keys",
            compactGroupKey: "keys_main",
            channel: "R",
            group: "keys",
            note: "XLR out from keys rig",
          },
        ],
      },
      vocal_wireless: {
        type: "preset",
        id: "vocal_wireless",
        label: "Wireless vocal",
        group: "vocs",
        inputs: [
          {
            key: "voc_wireless",
            label: "Wireless vocal",
            group: "vocs",
            note: "Wireless handheld",
          },
        ],
      },
      vocal_wired: {
        type: "preset",
        id: "vocal_wired",
        label: "Wired vocal",
        group: "vocs",
        inputs: [
          {
            key: "voc_wired",
            label: "Wired vocal",
            group: "vocs",
            note: "SM58",
          },
        ],
      },
      vocal_lead_no_mic: {
        type: "preset",
        id: "vocal_lead_no_mic",
        label: "Lead vocal no mic",
        group: "vocs",
        inputs: [
          {
            key: "voc_lead_capability",
            label: "Lead vocal",
            group: "vocs",
            note: "BETA 58A on boom stand",
          },
        ],
      },
      vocal_back_no_mic: {
        type: "preset",
        id: "vocal_back_no_mic",
        label: "Back vocal no mic",
        group: "vocs",
        inputs: [
          {
            key: "voc_back_capability",
            label: "Back vocal",
            group: "vocs",
            note: "SM58 on boom stand",
          },
        ],
      },
      talkback: {
        type: "talkback_type",
        id: "talkback",
        label: "Talkback",
        group: "talkback",
        input: {
          key: "tb_{ownerKey}",
          label: "Talkback - {ownerLabel}",
          note: "Switched talkback mic",
        },
      },
      wedge: { type: "monitor", id: "wedge", label: "Wedge monitor" },
      iem_stereo_wireless: {
        type: "monitor",
        id: "iem_stereo_wireless",
        label: "IEM STEREO wireless",
      },
    };

    const repo = createRepo({ band, musicians, presets, project });
    const loadedProject = repo.getProject(project.id);
    const vm = buildDocument(loadedProject, repo);

    expect(loadedProject).toMatchObject({
      id: project.id,
      eventDate: "2026-06-20",
      eventVenue: "Regression Hall",
      lineup: {
        drums: [{ slot: 1, musicianId: "drm-1" }],
        bass: [{ slot: 1, musicianId: "bass-1" }],
        guitar: [{ slot: 1, musicianId: "gtr-1" }],
        keys: [{ slot: 1, musicianId: "keys-1" }],
        vocs: [
          { slot: 1, musicianId: "voc-f" },
          { slot: 2, musicianId: "voc-m" },
        ],
      },
      overlays: {
        leadVocals: ["voc-f", "keys-1", "voc-m"],
        backVocals: ["gtr-1"],
        talkback: { mode: "assigned", ownerId: "bass-1" },
      },
    });

    expect(pickRows(vm.inputRows)).toEqual([
      expect.objectContaining({ no: "1", label: "Kick OUT" }),
      expect.objectContaining({ no: "2", label: "Kick IN" }),
      expect.objectContaining({ no: "3", label: "Snare TOP" }),
      expect.objectContaining({ no: "4", label: "Snare BOTTOM" }),
      expect.objectContaining({ no: "5", label: "Hi-hat" }),
      expect.objectContaining({ no: "6", label: "Tom 1" }),
      expect.objectContaining({ no: "7", label: "Tom 2" }),
      expect.objectContaining({ no: "8", label: "Floor" }),
      expect.objectContaining({ no: "9", label: "OH L" }),
      expect.objectContaining({ no: "10", label: "OH R" }),
      expect.objectContaining({ no: "11", label: "PAD SFX" }),
      { no: "12", label: "---", note: "---" },
      expect.objectContaining({
        no: "13+14",
        label: "Tracks",
        note: expect.stringMatching(/^2x TS jack 6\.3mm/),
      }),
      {
        no: "15",
        label: "Electric bass guitar",
        note: "XLR out from pedalboard",
      },
      {
        no: "16",
        label: "Electric guitar",
        note: "XLR out from pedalboard",
      },
      {
        no: "17+18",
        label: "Keys",
        note: "2x XLR out from keys rig",
      },
      {
        no: "19",
        label: "Back vocal (guitar)",
        note: "SM58 on boom stand",
      },
      {
        no: "20",
        label: "Lead vocal 1 (female)",
        note: "Wireless handheld",
      },
      { no: "21", label: "Lead vocal 3 (male)", note: "SM58" },
      {
        no: "22",
        label: "Lead vocal 2 (keys)",
        note: "BETA 58A on boom stand",
      },
      {
        no: "23",
        label: "Talkback (bass)",
        note: "Switched talkback mic",
      },
    ]);

    expect(
      vm.inputs.map(({ ch, key, label, group, ownerRole, ownerMusicianId }) => ({
        ch,
        key,
        label,
        group,
        ownerRole,
        ownerMusicianId,
      })),
    ).toEqual([
      { ch: 1, key: "dr_kick_1_out", label: "Kick OUT", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 2, key: "dr_kick_1_in", label: "Kick IN", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 3, key: "dr_snare1_top", label: "Snare TOP", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 4, key: "dr_snare1_bottom", label: "Snare BOTTOM", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 5, key: "dr_hihat", label: "Hi-hat", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 6, key: "dr_tom_1", label: "Tom 1", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 7, key: "dr_tom_2", label: "Tom 2", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 8, key: "dr_floor_1", label: "Floor", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 9, key: "dr_oh_l", label: "OH L", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 10, key: "dr_oh_r", label: "OH R", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 11, key: "dr_pad_mono_sfx", label: "PAD SFX", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 12, key: "spare_ch_12", label: "---", group: "drums", ownerRole: "drums", ownerMusicianId: undefined },
      { ch: 13, key: "dr_tracks_l", label: "Backing track L", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 14, key: "dr_tracks_r", label: "Backing track R", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { ch: 15, key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass", ownerRole: "bass", ownerMusicianId: "bass-1" },
      { ch: 16, key: "el_guitar", label: "Electric guitar", group: "guitar", ownerRole: "guitar", ownerMusicianId: "gtr-1" },
      { ch: 17, key: "keys_l", label: "Keys", group: "keys", ownerRole: "keys", ownerMusicianId: "keys-1" },
      { ch: 18, key: "keys_r", label: "Keys", group: "keys", ownerRole: "keys", ownerMusicianId: "keys-1" },
      { ch: 19, key: "voc_back_guitar_1", label: "Back vocal (guitar)", group: "vocs", ownerRole: "guitar", ownerMusicianId: "gtr-1" },
      { ch: 20, key: "voc_lead_1", label: "Lead vocal 1 (female)", group: "vocs", ownerRole: "vocs", ownerMusicianId: "voc-f" },
      { ch: 21, key: "voc_lead_3", label: "Lead vocal 3 (male)", group: "vocs", ownerRole: "vocs", ownerMusicianId: "voc-m" },
      { ch: 22, key: "voc_lead_2", label: "Lead vocal 2 (keys)", group: "vocs", ownerRole: "keys", ownerMusicianId: "keys-1" },
      { ch: 23, key: "tb_bass", label: "Talkback (bass)", group: "talkback", ownerRole: "bass", ownerMusicianId: "bass-1" },
    ]);

    expect(
      vm.monitorTableRows.map(({ no, output, note, ownerRole, ownerMusicianId }) => ({
        no,
        output,
        note,
        ownerRole,
        ownerMusicianId,
      })),
    ).toEqual([
      {
        no: "1",
        output: "Guitar",
        note: "IEM STEREO wireless",
        ownerRole: "guitar",
        ownerMusicianId: "gtr-1",
      },
      {
        no: "2",
        output: "Lead vocal 1 (female)",
        note: "Wedge monitor (provided by FOH)",
        ownerRole: "vocs",
        ownerMusicianId: "voc-f",
      },
      {
        no: "3",
        output: "Lead vocal 3 (male)",
        note: "Wedge monitor (provided by FOH)",
        ownerRole: "vocs",
        ownerMusicianId: "voc-m",
      },
      {
        no: "4",
        output: "Keys",
        note: "IEM STEREO wireless",
        ownerRole: "keys",
        ownerMusicianId: "keys-1",
      },
      {
        no: "5",
        output: "Bass",
        note: "Wedge monitor (provided by FOH) + Additional wedge monitor 1x",
        ownerRole: "bass",
        ownerMusicianId: "bass-1",
      },
      {
        no: "6",
        output: "Drums",
        note: "IEM STEREO wireless",
        ownerRole: "drums",
        ownerMusicianId: "drm-1",
      },
    ]);

    expect(vm.monitors).toEqual([
      {
        id: "drm-1:iem_stereo_wireless",
        label: "IEM STEREO wireless",
        kind: "iem",
      },
      { id: "bass-1:wedge", label: "Wedge monitor", kind: "wedge" },
      {
        id: "gtr-1:iem_stereo_wireless",
        label: "IEM STEREO wireless",
        kind: "iem",
      },
      {
        id: "keys-1:iem_stereo_wireless",
        label: "IEM STEREO wireless",
        kind: "iem",
      },
      { id: "voc-f:wedge", label: "Wedge monitor", kind: "wedge" },
      { id: "voc-m:wedge", label: "Wedge monitor", kind: "wedge" },
    ]);

    expect(vm.stageplan.lineupByRole).toMatchObject({
      drums: { musicianId: "drm-1", firstName: "Dana", isBandLeader: false },
      bass: { musicianId: "bass-1", firstName: "Ben", isBandLeader: false },
      guitar: { musicianId: "gtr-1", firstName: "Gina", isBandLeader: false },
      keys: { musicianId: "keys-1", firstName: "Kira", isBandLeader: false },
      vocs: { musicianId: "voc-f", firstName: "Vera", isBandLeader: true },
    });
    expect(vm.stageplan.leadVocals).toEqual([
      { musicianId: "voc-f", firstName: "Vera", isBandLeader: true },
      { musicianId: "voc-m", firstName: "Marek", isBandLeader: false },
    ]);
    expect(vm.stageplan.monitorOutputs).toEqual([
      {
        no: 1,
        output: "Guitar",
        note: "IEM STEREO wireless",
        ownerRole: "guitar",
        ownerMusicianId: "gtr-1",
      },
      {
        no: 2,
        output: "Lead vocal 1 (female)",
        note: "Wedge monitor (provided by FOH)",
        ownerRole: "vocs",
        ownerMusicianId: "voc-f",
      },
      {
        no: 3,
        output: "Lead vocal 3 (male)",
        note: "Wedge monitor (provided by FOH)",
        ownerRole: "vocs",
        ownerMusicianId: "voc-m",
      },
      {
        no: 4,
        output: "Keys",
        note: "IEM STEREO wireless",
        ownerRole: "keys",
        ownerMusicianId: "keys-1",
      },
      {
        no: 5,
        output: "Bass",
        note: "Wedge monitor (provided by FOH) + Additional wedge monitor 1x",
        ownerRole: "bass",
        ownerMusicianId: "bass-1",
      },
      {
        no: 6,
        output: "Drums",
        note: "IEM STEREO wireless",
        ownerRole: "drums",
        ownerMusicianId: "drm-1",
      },
    ]);
    expect(
      vm.stageplan.inputs.map(({ channelNo, label, group, ownerRole, ownerMusicianId }) => ({
        channelNo,
        label,
        group,
        ownerRole,
        ownerMusicianId,
      })),
    ).toEqual([
      { channelNo: 1, label: "Kick OUT", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 2, label: "Kick IN", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 3, label: "Snare TOP", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 4, label: "Snare BOTTOM", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 5, label: "Hi-hat", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 6, label: "Tom 1", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 7, label: "Tom 2", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 8, label: "Floor", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 9, label: "OH L", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 10, label: "OH R", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 11, label: "PAD SFX", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 13, label: "Backing track L", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 14, label: "Backing track R", group: "drums", ownerRole: "drums", ownerMusicianId: "drm-1" },
      { channelNo: 15, label: "Electric bass guitar", group: "bass", ownerRole: "bass", ownerMusicianId: "bass-1" },
      { channelNo: 16, label: "Electric guitar", group: "guitar", ownerRole: "guitar", ownerMusicianId: "gtr-1" },
      { channelNo: 17, label: "Keys", group: "keys", ownerRole: "keys", ownerMusicianId: "keys-1" },
      { channelNo: 18, label: "Keys", group: "keys", ownerRole: "keys", ownerMusicianId: "keys-1" },
      { channelNo: 19, label: "Back vocal (guitar)", group: "vocs", ownerRole: "guitar", ownerMusicianId: "gtr-1" },
      { channelNo: 20, label: "Lead vocal 1 (female)", group: "vocs", ownerRole: "vocs", ownerMusicianId: "voc-f" },
      { channelNo: 21, label: "Lead vocal 3 (male)", group: "vocs", ownerRole: "vocs", ownerMusicianId: "voc-m" },
      { channelNo: 22, label: "Lead vocal 2 (keys)", group: "vocs", ownerRole: "keys", ownerMusicianId: "keys-1" },
      { channelNo: 23, label: "Talkback (bass)", group: "talkback", ownerRole: "bass", ownerMusicianId: "bass-1" },
    ]);
    expect(vm.stageplan.powerByRole).toMatchObject({
      drums: { hasPowerBadge: false, powerBadgeText: "" },
      bass: { hasPowerBadge: false, powerBadgeText: "" },
      guitar: { hasPowerBadge: true, powerBadgeText: "4x 230 V" },
      keys: { hasPowerBadge: true, powerBadgeText: "2x 230 V" },
      vocs: { hasPowerBadge: false, powerBadgeText: "" },
    });
  });
});
