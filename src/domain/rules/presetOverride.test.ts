import { describe, expect, it } from "vitest";
import { resolveStereoPair } from "../formatters/index.js";
import type { MusicianSetupPreset } from "../model/types.js";
import {
  DEFAULT_MONITOR_MIX_LIMIT,
  applyPresetOverride,
  summarizeEffectivePresetValidation,
  validateEffectivePresets,
  normalizeBassConnectionOverridePatch,
  normalizeSetupOverridePatch,
} from "./presetOverride.js";

const basePreset: MusicianSetupPreset = {
  inputs: [
    { key: "gtr_l", label: "GTR L", group: "guitar" },
    { key: "gtr_r", label: "GTR R", group: "guitar" },
  ],
  monitoring: {
    monitorRef: "iem_stereo_wired",
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

  it("replaces a main input in place", () => {
    const bassBase: MusicianSetupPreset = {
      inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" }],
      monitoring: basePreset.monitoring,
    };
    const next = applyPresetOverride(bassBase, {
      inputs: {
        replace: [{ targetKey: "el_bass_xlr_amp", with: { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", note: "XLR out from pedalboard", group: "bass" } }],
      },
    });
    expect(next.inputs).toEqual([
      { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", note: "XLR out from pedalboard", group: "bass" },
    ]);
  });

  it("normalizes legacy bass add override into replacement", () => {
    const bassBase: MusicianSetupPreset = {
      inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" }],
      monitoring: basePreset.monitoring,
    };
    const next = applyPresetOverride(bassBase, {
      inputs: {
        add: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", note: "XLR out from pedalboard", group: "bass" }],
      },
    });
    expect(next.inputs.map((item) => item.key)).toEqual(["el_bass_xlr_pedalboard"]);
  });

  it("keeps additionals right after the base main group", () => {
    const bassBase: MusicianSetupPreset = {
      inputs: [
        { key: "el_bass_xlr_amp", label: "Electric bass guitar", group: "bass" },
        { key: "el_bass_mic", label: "Electric bass mic", group: "bass" },
      ],
      monitoring: basePreset.monitoring,
    };
    const next = applyPresetOverride(bassBase, {
      inputs: {
        add: [{ key: "bass_synth", label: "Bass synth", group: "bass" }],
      },
    });
    expect(next.inputs.map((item) => item.key)).toEqual(["el_bass_xlr_amp", "el_bass_mic", "bass_synth"]);
  });



  it("normalizes legacy bass add override and keeps other additions", () => {
    const bassBase: MusicianSetupPreset = {
      inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" }],
      monitoring: basePreset.monitoring,
    };
    const normalized = normalizeBassConnectionOverridePatch(bassBase, {
      inputs: {
        add: [
          { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", note: "XLR out from pedalboard", group: "bass" },
          { key: "el_bass_mic", label: "Electric bass mic", group: "bass" },
          { key: "bass_synth", label: "Bass synth", group: "bass" },
        ],
      },
    });

    expect(normalized?.inputs?.replace).toEqual([
      {
        targetKey: "el_bass_xlr_amp",
        with: { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", note: "XLR out from pedalboard", group: "bass" },
      },
    ]);
    expect(normalized?.inputs?.add?.map((item) => item.key)).toEqual(["el_bass_mic", "bass_synth"]);
  });

  it("supports remove operation alias", () => {
    const next = applyPresetOverride(basePreset, { inputs: { remove: ["gtr_r"] } });
    expect(next.inputs.map((input) => input.key)).toEqual(["gtr_l"]);
  });

  it("updates label/note/group", () => {
    const next = applyPresetOverride(basePreset, {
      inputs: {
        update: [{ key: "gtr_l", label: "Electric guitar left", note: "Radial DI", group: "keys" }],
      },
    });
    expect(next.inputs[0]).toMatchObject({ label: "Electric guitar left", note: "Radial DI", group: "keys" });
  });

  it("drops no-op overrides after normalization", () => {
    const normalized = normalizeSetupOverridePatch(basePreset, {
      monitoring: { monitorRef: "iem_stereo_wired" },
    });
    expect(normalized).toBeUndefined();
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
        monitoring: { monitorRef: "wedge" as const },
      },
    }));
    expect(validateEffectivePresets(slots)).toContain("Total input channels exceed limit: 31/30.");
  });

  it("does not block when monitor mix limit is exceeded", () => {
    const slots = Array.from({ length: 9 }, () => ({
      group: "guitar",
      preset: {
        inputs: [],
        monitoring: { monitorRef: "iem_stereo_wired" as const },
      },
    }));
    expect(validateEffectivePresets(slots)).not.toContain(
      `Total required monitor mixes (aux sends) exceed the configured limit (9 > ${DEFAULT_MONITOR_MIX_LIMIT}).`,
    );
    expect(summarizeEffectivePresetValidation(slots).warnings).toContain(
      `Total required monitor mixes (aux sends) exceed the configured limit (9 > ${DEFAULT_MONITOR_MIX_LIMIT}).`,
    );
  });

  it("does not count wedge defaults as aux sends", () => {
    const slots = Array.from({ length: 10 }, () => ({
      group: "vocs",
      preset: {
        inputs: [],
        monitoring: { monitorRef: "wedge" as const },
      },
    }));
    const summary = summarizeEffectivePresetValidation(slots);
    expect(summary.totals.monitorMixes).toBe(0);
    expect(summary.warnings).toEqual([]);
  });

  it("uses monitoring overrides to update total mixes", () => {
    const effective = applyPresetOverride(basePreset, {
      monitoring: { monitorRef: "iem_mono_wireless" },
    });
    const summary = summarizeEffectivePresetValidation([{ group: "guitar", preset: effective }]);
    expect(summary.totals.monitorMixes).toBe(1);
    expect(summary.totals.monitorMixLimit).toBe(DEFAULT_MONITOR_MIX_LIMIT);
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
