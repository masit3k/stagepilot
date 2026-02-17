import { describe, expect, it } from "vitest";
import type { PresetEntity, PresetItem } from "../model/types.js";
import { resolveDefaultMusicianSetup } from "./resolveDefaultMusicianSetup.js";

const presetsByRef: Record<string, PresetEntity> = {
  el_bass_xlr_amp: {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Electric bass guitar",
    group: "bass",
    setupGroup: "electric_bass",
    inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", group: "bass" }],
  } as PresetEntity,
  el_bass_xlr_pedalboard: {
    type: "preset",
    id: "el_bass_xlr_pedalboard",
    label: "Electric bass guitar",
    group: "bass",
    setupGroup: "electric_bass",
    inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" }],
  } as PresetEntity,
  el_bass_mic: {
    type: "preset",
    id: "el_bass_mic",
    label: "Electric bass mic",
    group: "bass",
    setupGroup: "bass_mic",
    inputs: [{ key: "el_bass_mic", label: "Electric bass mic", group: "bass" }],
  } as PresetEntity,
};

describe("resolveDefaultMusicianSetup", () => {
  it("includes bass main + optional mic defaults from musician preset refs", () => {
    const presetItems: PresetItem[] = [
      { kind: "preset", ref: "el_bass_xlr_pedalboard" },
      { kind: "preset", ref: "el_bass_mic" },
    ];

    const resolved = resolveDefaultMusicianSetup({
      role: "bass",
      presetItems,
      getPresetByRef: (ref) => presetsByRef[ref],
    });

    expect(resolved.inputs.map((item) => item.key)).toEqual([
      "el_bass_xlr_pedalboard",
      "el_bass_mic",
    ]);
  });
});
