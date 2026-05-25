import { describe, expect, it } from "vitest";
import type {
  MusicianSetupPreset,
  Preset,
} from "../../../../../../../../src/domain/model/types";
import { applyPresetOverride } from "../../../../../../../../src/domain/rules/presetOverride";
import { buildKeysFields } from "./buildKeysFields";

const presets: Preset[] = [
  {
    type: "preset",
    id: "keys_stereo_xlr",
    label: "Keys stereo XLR",
    group: "keys",
    inputs: [
      { key: "keys_l", label: "Keys L", note: "XLR out from rack" },
      { key: "keys_r", label: "Keys R", note: "XLR out from rack" },
    ],
  },
  {
    type: "preset",
    id: "keys_mono_xlr",
    label: "Keys mono XLR",
    group: "keys",
    inputs: [{ key: "keys", label: "Keys", note: "XLR out from rack" }],
  },
  {
    type: "preset",
    id: "keys_stereo_jack",
    label: "Keys stereo jack",
    group: "keys",
    inputs: [
      { key: "keys_l", label: "Keys L", note: "TS jack 6.3mm – DI box" },
      { key: "keys_r", label: "Keys R", note: "TS jack 6.3mm – DI box" },
    ],
  },
  {
    type: "preset",
    id: "keys_mono_jack",
    label: "Keys mono jack",
    group: "keys",
    inputs: [{ key: "keys", label: "Keys", note: "TS jack 6.3mm – DI box" }],
  },
  {
    type: "preset",
    id: "synth",
    label: "Synth",
    group: "keys",
    inputs: [{ key: "synth_l", label: "Synth L" }],
  },
];

const defaultPreset: MusicianSetupPreset = {
  inputs: [
    {
      key: "keys_l",
      label: "Keys L",
      group: "keys",
      note: "XLR out from rack",
    },
    {
      key: "keys_r",
      label: "Keys R",
      group: "keys",
      note: "XLR out from rack",
    },
  ],
  monitoring: { monitorRef: "wedge" },
};

describe("buildKeysFields", () => {
  it("exposes count plus independent variant fields without synth options", () => {
    const fields = buildKeysFields(presets);
    expect(fields.map((field) => field.id)).toEqual([
      "keys-inputs",
      "keys-unit-1-variant",
      "keys-unit-2-variant",
      "keys-unit-3-variant",
      "keys-unit-4-variant",
      "keys-unit-5-variant",
    ]);
    const firstVariant = fields[1];
    if (firstVariant.kind !== "dropdown")
      throw new Error("missing variant dropdown");
    expect(
      firstVariant
        .options({ defaultPreset, effectivePreset: defaultPreset })
        .map((item) => item.label),
    ).toEqual(["Stereo XLR", "Mono XLR", "Stereo jack", "Mono jack"]);
  });

  it("appends default units up to max 5 and preserves earlier variants", () => {
    const fields = buildKeysFields(presets);
    const grid = fields[0];
    if (grid.kind !== "toggleGrid") throw new Error("missing count field");
    const countField = grid.fields[0];
    const unit2 = fields[2];
    if (unit2.kind !== "dropdown") throw new Error("missing second variant");

    const patchTwo = countField.setCount(
      { defaultPreset, effectivePreset: defaultPreset },
      2,
    );
    const effectiveTwo = applyPresetOverride(defaultPreset, patchTwo);
    const patchMixed = unit2.setValue(
      { defaultPreset, effectivePreset: effectiveTwo, patch: patchTwo },
      "mono_jack",
    );
    const effectiveMixed = applyPresetOverride(defaultPreset, patchMixed);
    const patchFive = countField.setCount(
      { defaultPreset, effectivePreset: effectiveMixed, patch: patchMixed },
      99,
    );
    const effectiveFive = applyPresetOverride(defaultPreset, patchFive);

    expect(effectiveFive.inputs.map((item) => [item.key, item.note])).toEqual([
      ["keys_l", "XLR out from rack"],
      ["keys_r", "XLR out from rack"],
      ["keys_2", "TS jack 6.3mm – DI box"],
      ["keys_3_l", "XLR out from rack"],
      ["keys_3_r", "XLR out from rack"],
      ["keys_4_l", "XLR out from rack"],
      ["keys_4_r", "XLR out from rack"],
      ["keys_5_l", "XLR out from rack"],
      ["keys_5_r", "XLR out from rack"],
    ]);
  });

  it("changing unit 2 does not change unit 1", () => {
    const fields = buildKeysFields(presets);
    const grid = fields[0];
    const unit2 = fields[2];
    if (grid.kind !== "toggleGrid" || unit2.kind !== "dropdown")
      throw new Error("missing fields");
    const patchTwo = grid.fields[0].setCount(
      { defaultPreset, effectivePreset: defaultPreset },
      2,
    );
    const effectiveTwo = applyPresetOverride(defaultPreset, patchTwo);
    const patch = unit2.setValue(
      { defaultPreset, effectivePreset: effectiveTwo, patch: patchTwo },
      "mono_xlr",
    );
    const effective = applyPresetOverride(defaultPreset, patch);
    expect(effective.inputs.map((item) => [item.key, item.note])).toEqual([
      ["keys_l", "XLR out from rack"],
      ["keys_r", "XLR out from rack"],
      ["keys_2", "XLR out from rack"],
    ]);
  });
});
