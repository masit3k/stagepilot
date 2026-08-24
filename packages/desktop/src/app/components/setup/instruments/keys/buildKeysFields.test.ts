import { describe, expect, it } from "vitest";
import type {
  MusicianSetupPreset,
  Preset,
  PresetOverridePatch,
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
  monitoring: { monitorRef: "wedge_foh" },
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

/**
 * Kanály verbatim z `data/assets/presets/groups/keys/` a slot, který má
 * `compactGroupKey`/`baseLabel` — právě na nich vada stojí.
 */
const editedDefaultPreset: MusicianSetupPreset = {
  inputs: [
    {
      key: "keys_l",
      label: "Keys L",
      baseLabel: "Keys",
      compactGroupKey: "keys",
      channel: "L",
      group: "keys",
      note: "XLR out from rack",
    },
    {
      key: "keys_r",
      label: "Keys R",
      baseLabel: "Keys",
      compactGroupKey: "keys",
      channel: "R",
      group: "keys",
      note: "XLR out from rack",
    },
  ],
  monitoring: { monitorRef: "wedge_foh" },
};

function stateFor(patch?: PresetOverridePatch) {
  return {
    defaultPreset: editedDefaultPreset,
    effectivePreset: applyPresetOverride(editedDefaultPreset, patch),
    ...(patch ? { patch } : {}),
  };
}

function variantField(index: number) {
  const field = buildKeysFields(presets)[index + 1];
  if (field.kind !== "dropdown") throw new Error("missing variant dropdown");
  return field;
}

function countField() {
  const grid = buildKeysFields(presets)[0];
  if (grid.kind !== "toggleGrid") throw new Error("missing count grid");
  const field = grid.fields[0];
  if (field.kind !== "toggleWithStepper")
    throw new Error("missing count field");
  return field;
}

function effectiveAfter(patch: PresetOverridePatch | undefined) {
  return applyPresetOverride(editedDefaultPreset, patch).inputs;
}

describe("buildKeysFields — user edits on channels that survive a switch", () => {
  it("keeps the user's name when the variant switches under the same channel key", () => {
    // Změřená vada (táž jako u kytary, `buildGuitarFields`): `rebuildInputs`
    // bere `keep` z efektivního presetu, ale klávesové kanály syntetizuje
    // `buildKeysUnitInputs` **panensky**. Přepnutí Stereo XLR → Stereo jack
    // klíč `keys_l` nemění, kanál tedy přežije — ale vrátí se s katalogovým
    // popiskem, `withInputsTarget` proti defaultu nenajde rozdíl v popisku,
    // `update` se poskládá znovu bez něj a uživatelovo jméno tiše zmizí.
    const patch: PresetOverridePatch = {
      inputs: { update: [{ key: "keys_l", label: "Nord Stage 3 L" }] },
    };

    const after = effectiveAfter(
      variantField(0).setValue(stateFor(patch), "stereo_jack"),
    );

    expect(after.find((item) => item.key === "keys_l")?.label).toBe(
      "Nord Stage 3 L",
    );
  });

  it("still lets the variant switch rewrite the note it owns", () => {
    // Protiváha k testu výše a důvod, proč se u kláves nesmí přenášet celý
    // kanál jako u kytary: poznámka je tady **nositel zapojení**
    // (`variantFromInput` z ní variantu čte zpátky). Kdyby se přenesla,
    // přepnutí na jack by neudělalo nic.
    const patch: PresetOverridePatch = {
      inputs: {
        update: [
          {
            key: "keys_l",
            label: "Nord Stage 3 L",
            note: "vlastní DI, prosím",
          },
        ],
      },
    };

    const after = effectiveAfter(
      variantField(0).setValue(stateFor(patch), "stereo_jack"),
    );

    const left = after.find((item) => item.key === "keys_l");
    expect(left?.label).toBe("Nord Stage 3 L");
    expect(left?.note).toBe("TS jack 6.3mm – DI box");
  });

  it("keeps the user's name and note when only the unit count changes", () => {
    // Přidání druhé jednotky zapojení nemění, jen přeznačuje `Keys` na
    // `Keys 1`. Uživatelovo jméno i poznámka tedy musí přežít obojí.
    const patch: PresetOverridePatch = {
      inputs: {
        update: [
          {
            key: "keys_l",
            label: "Nord Stage 3 L",
            note: "vlastní DI, prosím",
          },
        ],
      },
    };

    const after = effectiveAfter(countField().setCount(stateFor(patch), 2));

    const left = after.find((item) => item.key === "keys_l");
    expect(left?.label).toBe("Nord Stage 3 L");
    expect(left?.note).toBe("vlastní DI, prosím");
  });

  it("still renumbers a channel the user never renamed", () => {
    // Protiváha: zachování se smí týkat jen kanálů, které uživatel skutečně
    // upravil. Nedotčený `keys_r` se s druhou jednotkou přeznačit musí.
    const patch: PresetOverridePatch = {
      inputs: { update: [{ key: "keys_l", label: "Nord Stage 3 L" }] },
    };

    const after = effectiveAfter(countField().setCount(stateFor(patch), 2));

    expect(after.find((item) => item.key === "keys_r")?.label).toBe("Keys 1 R");
    expect(after.find((item) => item.key === "keys_2_l")?.label).toBe(
      "Keys 2 L",
    );
  });

  it("leaves a channel the user never touched exactly as the preset builds it", () => {
    const after = effectiveAfter(
      variantField(0).setValue(stateFor(), "stereo_jack"),
    );

    expect(after.map((item) => [item.key, item.label, item.note])).toEqual([
      ["keys_l", "Keys L", "TS jack 6.3mm – DI box"],
      ["keys_r", "Keys R", "TS jack 6.3mm – DI box"],
    ]);
  });

  it("lets Reset still discard the user's edits", () => {
    // `reset` u počtu míří na `defaultPreset.inputs` a se zachováním se
    // potkat nesmí — jinak by se z resetu stal no-op.
    const patch: PresetOverridePatch = {
      inputs: { update: [{ key: "keys_l", label: "Nord Stage 3 L" }] },
    };

    expect(countField().reset?.(stateFor(patch))).toBeUndefined();
  });
});
