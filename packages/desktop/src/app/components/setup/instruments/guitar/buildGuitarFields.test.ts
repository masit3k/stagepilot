import { describe, expect, it } from "vitest";
import type { InputChannel, Preset, PresetOverridePatch } from "../../../../../../../../src/domain/model/types";
import { applyPresetOverride } from "../../../../../../../../src/domain/rules/presetOverride";
import type { EventSetupEditState } from "../../adapters/eventSetupAdapter";
import { buildGuitarFields } from "./buildGuitarFields";

const presets: Preset[] = [
  { type: "preset", id: "el_guitar_mic", label: "Electric guitar (mic)", group: "guitar", inputs: [{ key: "el_guitar_mic", label: "Electric guitar" }] },
  { type: "preset", id: "el_guitar_xlr_mono", label: "Electric guitar (XLR mono)", group: "guitar", inputs: [{ key: "el_guitar_xlr_mono", label: "Electric guitar" }] },
  { type: "preset", id: "el_guitar_xlr_stereo", label: "Electric guitar (XLR stereo)", group: "guitar", inputs: [{ key: "el_guitar_xlr_stereo_l", label: "Electric guitar L" }, { key: "el_guitar_xlr_stereo_r", label: "Electric guitar R" }] },
  { type: "preset", id: "ac_guitar", label: "Acoustic guitar", group: "guitar", inputs: [{ key: "ac_guitar", label: "Acoustic guitar" }] },
] as Preset[];

describe("buildGuitarFields", () => {
  it("keeps exact connection option order", () => {
    const field = buildGuitarFields(presets).find((item) => item.kind === "dropdown");
    if (!field || field.kind !== "dropdown") throw new Error("missing field");
    expect(field.options({ defaultPreset: { inputs: [], monitoring: { monitorRef: "wedge_foh" } }, effectivePreset: { inputs: [], monitoring: { monitorRef: "wedge_foh" } } }).map((item) => item.label)).toEqual([
      "Electric guitar (mic)",
      "Electric guitar (XLR mono)",
      "Electric guitar (XLR stereo)",
    ]);
  });
});
/**
 * Kanály verbatim z `data/assets/presets/groups/guitar/` — klíče se od
 * zjednodušených `presets` výše liší (`el_guitar_xlr`, ne
 * `el_guitar_xlr_mono`) a právě na nich vada stojí.
 */
const assetPresets: Preset[] = [
  { type: "preset", id: "el_guitar_mic", label: "Electric guitar (mic)", group: "guitar", inputs: [{ key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet – small boom mic stand" }] },
  { type: "preset", id: "el_guitar_xlr_mono", label: "Electric guitar (XLR mono)", group: "guitar", inputs: [{ key: "el_guitar_xlr", label: "Electric guitar", note: "XLR out from pedalboard" }] },
  { type: "preset", id: "el_guitar_xlr_stereo", label: "Electric guitar (XLR stereo)", group: "guitar", inputs: [{ key: "el_guitar_xlr_l", label: "Electric guitar L", note: "XLR out from pedalboard" }, { key: "el_guitar_xlr_r", label: "Electric guitar R", note: "XLR out from pedalboard" }] },
  { type: "preset", id: "ac_guitar", label: "Acoustic guitar", group: "guitar", inputs: [{ key: "ac_guitar", label: "Acoustic guitar", note: "TS jack 6.3mm – DI box" }] },
] as Preset[];

function stateFor(defaultInputs: InputChannel[], patch?: PresetOverridePatch): EventSetupEditState {
  const defaultPreset = { inputs: defaultInputs, monitoring: { monitorRef: "wedge_foh" } };
  return {
    defaultPreset,
    effectivePreset: applyPresetOverride(defaultPreset, patch),
    ...(patch ? { patch } : {}),
  };
}

function connectionField() {
  const field = buildGuitarFields(assetPresets).find((item) => item.kind === "dropdown");
  if (!field || field.kind !== "dropdown") throw new Error("missing connection field");
  return field;
}

function acousticField() {
  const grid = buildGuitarFields(assetPresets).find((item) => item.kind === "toggleGrid");
  if (!grid || grid.kind !== "toggleGrid") throw new Error("missing toggle grid");
  const field = grid.fields.find((item) => item.id === "guitar-acoustic");
  if (!field || field.kind !== "toggle") throw new Error("missing acoustic field");
  return field;
}

describe("buildGuitarFields — user edits on channels that survive a switch", () => {
  it("keeps the user's name and note on the mic channel when the main connection moves to XLR mono", () => {
    // Změřená vada: přepnutí mikrofon → XLR mono mikrofon **nezahodí**
    // (`micOnCab` ho vrátí jako doplněk), ale `rebuild` ho vrátí z katalogu
    // presetů, tedy v panenské podobě. `withInputsTarget` pak proti defaultu
    // nenajde žádný rozdíl, `update` vypadne z patche a uživatelovo jméno
    // i poznámka tiše zmizí — u kanálu, který na pódiu dál stojí.
    // `resolveDroppedUserEdits` o tom mlčí, protože klíč v efektivní sadě
    // zůstal.
    const defaultInputs: InputChannel[] = [{ key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet – small boom mic stand" }];
    const patch: PresetOverridePatch = { inputs: { update: [{ key: "el_guitar_mic", label: "Sennheiser e906", note: "vlastní mikrofon, prosím použít" }] } };
    const state = stateFor(defaultInputs, patch);

    const next = connectionField().setValue(state, "el_guitar_xlr_mono");
    const after = applyPresetOverride(state.defaultPreset, next).inputs;

    expect(after.map((item) => item.key).sort()).toEqual(["el_guitar_mic", "el_guitar_xlr"]);
    const mic = after.find((item) => item.key === "el_guitar_mic");
    expect(mic?.label).toBe("Sennheiser e906");
    expect(mic?.note).toBe("vlastní mikrofon, prosím použít");
  });

  it("keeps the user's note on the acoustic channel when the main connection changes under it", () => {
    const defaultInputs: InputChannel[] = [
      { key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet – small boom mic stand" },
      { key: "ac_guitar", label: "Acoustic guitar", note: "TS jack 6.3mm – DI box" },
    ];
    const patch: PresetOverridePatch = { inputs: { update: [{ key: "ac_guitar", label: "Taylor 814ce", note: "vlastní DI" }] } };
    const state = stateFor(defaultInputs, patch);

    const next = connectionField().setValue(state, "el_guitar_xlr_stereo");
    const after = applyPresetOverride(state.defaultPreset, next).inputs;

    const acoustic = after.find((item) => item.key === "ac_guitar");
    expect(acoustic?.label).toBe("Taylor 814ce");
    expect(acoustic?.note).toBe("vlastní DI");
  });

  it("keeps the user's note on the mic channel when the acoustic toggle flips", () => {
    const defaultInputs: InputChannel[] = [{ key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet – small boom mic stand" }];
    const patch: PresetOverridePatch = { inputs: { update: [{ key: "el_guitar_mic", label: "Sennheiser e906" }] } };
    const state = stateFor(defaultInputs, patch);

    const next = acousticField().setValue(state, true);
    const after = applyPresetOverride(state.defaultPreset, next).inputs;

    expect(after.find((item) => item.key === "el_guitar_mic")?.label).toBe("Sennheiser e906");
    expect(after.find((item) => item.key === "ac_guitar")?.label).toBe("Acoustic guitar");
  });

  it("still takes a channel the user never touched straight from the preset", () => {
    // Protiváha: zachování se smí týkat jen kanálů, které uživatel skutečně
    // upravil. Nově přidaný kanál musí přijít z katalogu.
    const defaultInputs: InputChannel[] = [{ key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet – small boom mic stand" }];
    const state = stateFor(defaultInputs);

    const next = connectionField().setValue(state, "el_guitar_xlr_mono");
    const after = applyPresetOverride(state.defaultPreset, next).inputs;

    const xlr = after.find((item) => item.key === "el_guitar_xlr");
    expect(xlr?.label).toBe("Electric guitar");
    expect(xlr?.note).toBe("XLR out from pedalboard");
  });

  it("lets Reset still discard the user's edits", () => {
    // `reset` míří na `defaultPreset.inputs` a nesmí se zachováním potkat —
    // jinak by se z resetu stal no-op.
    const defaultInputs: InputChannel[] = [{ key: "el_guitar_mic", label: "Electric guitar", note: "Mic on cabinet – small boom mic stand" }];
    const patch: PresetOverridePatch = { inputs: { update: [{ key: "el_guitar_mic", label: "Sennheiser e906" }] } };
    const state = stateFor(defaultInputs, patch);

    expect(connectionField().reset?.(state)).toBeUndefined();
  });
});

