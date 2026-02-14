import { describe, expect, it } from "vitest";
import { resolveStereoPair } from "../formatters/index.js";
import type { MusicianSetupPreset } from "../model/types.js";
import {
  applyPresetOverride,
  validateEffectivePresets,
} from "./presetOverride.js";

const basePreset: MusicianSetupPreset = {
  inputs: [
    { key: "gtr_l", label: "GTR L", group: "guitar" },
    { key: "gtr_r", label: "GTR R", group: "guitar" },
  ],
  monitoring: {
    type: "iem",
    mode: "stereo",
    mixCount: 1,
  },
};

describe("applyPresetOverride", () => {
  it("returns default when patch is missing", () => {
    expect(applyPresetOverride(basePreset)).toEqual(basePreset);
  });

  it("removes keys", () => {
    const next = applyPresetOverride(basePreset, { inputs: { removeKeys: ["gtr_r"] } });
    expect(next.inputs.map((input) => input.key)).toEqual(["gtr_l"]);
  });

  it("adds inputs", () => {
    const next = applyPresetOverride(basePreset, {
      inputs: { add: [{ key: "gtr_di", label: "GTR DI", group: "guitar" }] },
    });
    expect(next.inputs.at(-1)?.key).toBe("gtr_di");
  });

  it("updates label/note/group", () => {
    const next = applyPresetOverride(basePreset, {
      inputs: {
        update: [{ key: "gtr_l", label: "Electric guitar left", note: "Radial DI", group: "keys" }],
      },
    });
    expect(next.inputs[0]).toMatchObject({ label: "Electric guitar left", note: "Radial DI", group: "keys" });
  });

  it("throws on duplicate add key collision", () => {
    expect(() =>
      applyPresetOverride(basePreset, {
        inputs: { add: [{ key: "gtr_l", label: "Duplicate", group: "guitar" }] },
      }),
    ).toThrow(/collision/i);
  });
});

describe("validateEffectivePresets", () => {
  it("blocks more than 30 inputs", () => {
    const slots = Array.from({ length: 31 }, (_, idx) => ({
      group: "guitar",
      preset: {
        inputs: [{ key: `k${idx}`, label: `Input ${idx}`, group: "guitar" as const }],
        monitoring: { type: "wedge" as const, mode: "mono" as const, mixCount: 0 },
      },
    }));
    expect(validateEffectivePresets(slots)).toContain("Total input channels exceed limit: 31/30.");
  });

  it("blocks more than 6 monitor mixes", () => {
    const slots = Array.from({ length: 4 }, () => ({
      group: "guitar",
      preset: {
        inputs: [],
        monitoring: { type: "iem" as const, mode: "stereo" as const, mixCount: 2 },
      },
    }));
    expect(validateEffectivePresets(slots)).toContain("Total monitor mixes exceed limit: 8/6.");
  });

  it("keeps group order fixed", () => {
    const errors = validateEffectivePresets([
      { group: "guitar", preset: basePreset },
      { group: "bass", preset: basePreset },
    ]);
    expect(errors.join(" ")).toMatch(/Group order must stay fixed/);
  });
});

describe("stereo collapse regression", () => {
  it("keeps stereo pair collapse behavior after override", () => {
    const effective = applyPresetOverride(basePreset, {
      inputs: { update: [{ key: "gtr_l", label: "Guitar Left" }] },
    });
    const pair = resolveStereoPair(
      { key: effective.inputs[0].key, label: effective.inputs[0].label, group: "guitar" },
      { key: effective.inputs[1].key, label: effective.inputs[1].label, group: "guitar" },
    );
    expect(pair?.shouldCollapse).toBe(true);
  });
});
