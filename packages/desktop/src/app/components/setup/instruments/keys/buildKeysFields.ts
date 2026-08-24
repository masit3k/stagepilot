import type {
  InputChannel,
  Preset,
} from "../../../../../../../../src/domain/model/types";
import {
  type EventSetupEditState,
  withInputsTarget,
} from "../../adapters/eventSetupAdapter";
import type {
  DropdownFieldDef,
  SchemaNode,
  ToggleWithStepperFieldDef,
} from "../../schema/types";
import {
  DEFAULT_KEYS_VARIANT,
  KEYS_VARIANT_OPTIONS,
  type KeysUnit,
  type KeysVariant,
  MAX_KEYS_COUNT,
  MIN_KEYS_COUNT,
  buildKeysUnitInputs,
  clampKeysCount,
  readKeysUnits,
} from "./keysInstanceInputs";

type KeysPreset = Preset & {
  id:
    | "keys_stereo_xlr"
    | "keys_mono_xlr"
    | "keys_stereo_jack"
    | "keys_mono_jack";
};

function isKeysSetupInput(input: InputChannel): boolean {
  return (
    input.key === "keys" ||
    /^keys_(?:\d+_)?[lr]$/i.test(input.key) ||
    /^keys_\d+$/i.test(input.key) ||
    input.key === "synth_mono" ||
    input.key.startsWith("synth_")
  );
}

function readUnits(state: EventSetupEditState): KeysUnit[] {
  return readKeysUnits(state.effectivePreset.inputs);
}

/**
 * Kanál, který přepnutí přežije, si nese uživatelovu podobu, ne tu z katalogu.
 *
 * Táž vada jako u kytary (`buildGuitarFields`, `carryUserEdits`): `keep` se
 * bere z efektivního presetu, ale klávesové kanály `buildKeysUnitInputs`
 * syntetizuje **panensky**. Přepnutí Stereo XLR → Stereo jack klíč `keys_l`
 * nemění, kanál tedy přežije — ale vrátí se katalogový, `withInputsTarget`
 * proti defaultu nenajde rozdíl a uživatelovo jméno vypadne z `update`.
 * `resolveDroppedUserEdits` o tom mlčí schválně — hlásí jen kanály, které
 * z efektivní sady zmizely, a tenhle v ní zůstal.
 *
 * Proč se tady, na rozdíl od kytary, nepřenáší celý kanál: u kláves je
 * **poznámka nositelem zapojení** — `variantFromInput` z ní variantu čte
 * zpátky. Kdyby se přenesla, přepnutí na jack by neudělalo vůbec nic. Proto
 * mají obě uživatelem editovatelná pole (`updateInputRow` jiná nezná) různé
 * pravidlo:
 *
 * - `label` — uživatelovo jméno vyhrává vždy. Se zapojením nesouvisí a nemá
 *   ho přebít ani automatické přeznačení `Keys` → `Keys 1` při druhé
 *   jednotce.
 * - `note` — uživatelův přepis platí dál jen tam, kde ho preset nově
 *   nepředepisuje jinak (`pristine.note === next.note`). Když se zapojení
 *   jednotky mění, poznámku si bere zpátky preset: uživatel právě řekl
 *   „tenhle kanál jede přes jack" a to se do poznámky zapsat musí.
 *
 * Odchylka se měří proti panenské podobě **před** přepnutím, ne proti
 * defaultu slotu: default může mít jiný počet jednotek, a pak by se
 * automatické přeznačení tvářilo jako uživatelova úprava.
 */
function carryUserEdits(
  state: EventSetupEditState,
  previous: InputChannel[],
  next: InputChannel[],
): InputChannel[] {
  const effectiveByKey = new Map(
    state.effectivePreset.inputs.map((input) => [input.key, input]),
  );
  const previousByKey = new Map(previous.map((input) => [input.key, input]));
  return next.map((input) => {
    const effective = effectiveByKey.get(input.key);
    const pristine = previousByKey.get(input.key);
    if (!effective || !pristine) return input;
    const renamed = effective.label !== pristine.label;
    const renoted =
      effective.note !== pristine.note && pristine.note === input.note;
    if (!renamed && !renoted) return input;
    return {
      ...input,
      ...(renamed ? { label: effective.label } : {}),
      ...(renoted ? { note: effective.note } : {}),
    };
  });
}

function rebuildInputs(
  state: EventSetupEditState,
  units: KeysUnit[],
): InputChannel[] {
  const keep = state.effectivePreset.inputs.filter(
    (input) => !isKeysSetupInput(input),
  );
  const previous = buildKeysUnitInputs(readUnits(state));
  return [
    ...keep,
    ...carryUserEdits(state, previous, buildKeysUnitInputs(units)),
  ];
}

function patchUnits(state: EventSetupEditState, units: KeysUnit[]) {
  return withInputsTarget(
    state.defaultPreset.inputs,
    state.patch,
    rebuildInputs(state, units),
  );
}

function createCountField(): ToggleWithStepperFieldDef {
  return {
    kind: "toggleWithStepper",
    id: "keys-units-count",
    label: "Keys units",
    min: MIN_KEYS_COUNT,
    max: MAX_KEYS_COUNT,
    alwaysOn: true,
    getValue: () => true,
    getCount: (state) => readUnits(state).length,
    setCount: (state, value) => {
      const current = readUnits(state);
      const nextCount = clampKeysCount(value);
      const next = Array.from({ length: nextCount }).map((_, index) => ({
        variant: current[index]?.variant ?? DEFAULT_KEYS_VARIANT,
      }));
      return patchUnits(state, next);
    },
    setValue: (state) => patchUnits(state, readUnits(state)),
    isDefault: (state) =>
      readUnits(state).length ===
      readKeysUnits(state.defaultPreset.inputs).length,
    reset: (state) =>
      withInputsTarget(
        state.defaultPreset.inputs,
        state.patch,
        state.defaultPreset.inputs,
      ),
  };
}

function createVariantField(index: number): DropdownFieldDef {
  return {
    kind: "dropdown",
    id: `keys-unit-${index + 1}-variant`,
    label: index === 0 ? "Keys" : `Keys ${index + 1}`,
    getValue: (state) =>
      readUnits(state)[index]?.variant ?? DEFAULT_KEYS_VARIANT,
    setValue: (state, value) => {
      const current = readUnits(state);
      const next = current.map((unit, unitIndex) => ({
        variant: unitIndex === index ? (value as KeysVariant) : unit.variant,
      }));
      return patchUnits(state, next);
    },
    options: () => KEYS_VARIANT_OPTIONS,
    isDefault: (state) => {
      const current = readUnits(state)[index]?.variant ?? DEFAULT_KEYS_VARIANT;
      const defaultValue =
        readKeysUnits(state.defaultPreset.inputs)[index]?.variant ??
        DEFAULT_KEYS_VARIANT;
      return current === defaultValue;
    },
    reset: (state) => {
      const current = readUnits(state);
      const defaultUnits = readKeysUnits(state.defaultPreset.inputs);
      const next = current.map((unit, unitIndex) =>
        unitIndex === index
          ? { variant: defaultUnits[index]?.variant ?? DEFAULT_KEYS_VARIANT }
          : unit,
      );
      return patchUnits(state, next);
    },
    isVisible: (state) => index < readUnits(state).length,
  };
}

export function buildKeysFields(presets: Preset[]): SchemaNode[] {
  const activeKeysPresets = presets.filter(
    (preset): preset is KeysPreset =>
      preset.type === "preset" &&
      preset.group === "keys" &&
      [
        "keys_stereo_xlr",
        "keys_mono_xlr",
        "keys_stereo_jack",
        "keys_mono_jack",
      ].includes(preset.id),
  );
  if (activeKeysPresets.length === 0) return [];

  return [
    {
      kind: "toggleGrid",
      id: "keys-inputs",
      fields: [createCountField()],
    },
    ...Array.from({ length: MAX_KEYS_COUNT }).map((_, index) =>
      createVariantField(index),
    ),
  ];
}
