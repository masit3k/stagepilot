import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset, PresetOverridePatch } from "../../../../../../../src/domain/model/types";
import { areSetupsEqual, cleanupPatch, normalizeSetup, shouldEnableSetupReset } from "./eventSetupAdapter";

const defaultPreset: MusicianSetupPreset = {
  monitoring: { monitorRef: "wedge" },
  inputs: [{ key: "bass_main", label: "Bass" }],
};

describe("cleanupPatch", () => {
  it("removes zero additional wedge values from monitoring override", () => {
    const patch: PresetOverridePatch = { monitoring: { additionalWedgeCount: 0 } };
    expect(cleanupPatch(patch)).toBeUndefined();
  });
});

describe("shouldEnableSetupReset", () => {
  it("returns true when event contains presetOverride", () => {
    expect(shouldEnableSetupReset({
      eventOverride: { monitoring: { monitorRef: "iem_stereo_wireless" } },
      defaultPreset,
      effectivePreset: defaultPreset,
    })).toBe(true);
  });

  it("returns true when effective setup differs from defaults", () => {
    expect(shouldEnableSetupReset({
      defaultPreset,
      effectivePreset: {
        ...defaultPreset,
        monitoring: { monitorRef: "iem_stereo_wireless" },
      },
    })).toBe(true);
  });

  it("returns false when no event override exists and setup equals defaults", () => {
    expect(shouldEnableSetupReset({
      defaultPreset,
      effectivePreset: defaultPreset,
    })).toBe(false);
  });
});


describe("normalizeSetup / areSetupsEqual", () => {
  it("ignores input order and redundant wedge count", () => {
    const left: MusicianSetupPreset = {
      inputs: [
        { key: "voc_b", label: "Vocal B" },
        { key: "voc_a", label: "Vocal A" },
      ],
      monitoring: { monitorRef: "wedge", additionalWedgeCount: 0 },
    };
    const right: MusicianSetupPreset = {
      inputs: [
        { key: "voc_a", label: "Vocal A" },
        { key: "voc_b", label: "Vocal B" },
      ],
      monitoring: { monitorRef: "wedge" },
    };

    expect(areSetupsEqual(left, right)).toBe(true);
    expect(normalizeSetup(left)).toEqual(normalizeSetup(right));
  });
});
