import { describe, expect, it } from "vitest";
import type { Band, Musician, PresetEntity, Project } from "../model/types.js";
import { resolveEffectiveProjectSetup } from "./resolveEffectiveProjectSetup.js";

describe("resolveEffectiveProjectSetup", () => {
  it("applies monitoring overrides from lineup presetOverride", () => {
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
    const project: Project = {
      id: "p1",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        bass: {
          musicianId: "bass-1",
          presetOverride: {
            monitoring: { monitorRef: "iem_stereo_wired" },
          },
        },
      },
    };

    const presets: Record<string, PresetEntity> = {
      el_bass_xlr_pedalboard: {
        type: "preset",
        id: "el_bass_xlr_pedalboard",
        label: "Electric bass guitar",
        group: "bass",
        setupGroup: "electric_bass",
        inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
      } as PresetEntity,
      iem_stereo_wireless: { type: "monitor", id: "iem_stereo_wireless", label: "IEM STEREO wireless" } as PresetEntity,
      iem_stereo_wired: { type: "monitor", id: "iem_stereo_wired", label: "IEM STEREO wired" } as PresetEntity,
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "bass-1",
      getMusicianById: () => musician,
      getPresetByRef: (ref) => presets[ref],
    });

    expect(resolved.byMusicianId.get("bass-1")?.monitoring.monitorRef).toBe("iem_stereo_wired");
  });


  it("resolves drummer setup from canonical persisted drum_setup payload", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: "dr-1" },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
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
            pad: { enabled: true, mode: "sfx", channels: "stereo" },
            tracks: { enabled: false },
          },
        },
      ],
    };
    const project: Project = {
      id: "p-drum",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
    };

    const resolved = resolveEffectiveProjectSetup({
      project,
      band,
      bandLeaderId: "dr-1",
      getMusicianById: () => drummer,
      getPresetByRef: () => undefined,
    });

    expect(resolved.byMusicianId.get("dr-1")?.inputs.some((input) => input.key === "dr_pad_stereo_sfx_l")).toBe(true);
  });

});
