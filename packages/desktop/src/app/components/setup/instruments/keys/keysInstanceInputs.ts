import type { InputChannel } from "../../../../../../../../src/domain/model/types";

export const MIN_KEYS_COUNT = 1;
export const MAX_KEYS_COUNT = 5;

export type KeysVariant =
  | "stereo_xlr"
  | "mono_xlr"
  | "stereo_jack"
  | "mono_jack";

export type KeysUnit = {
  variant: KeysVariant;
};

const KEYS_XLR_NOTE = "XLR out from rack";
const KEYS_JACK_NOTE = "TS jack 6.3mm – DI box";

export const DEFAULT_KEYS_VARIANT: KeysVariant = "stereo_xlr";

export const KEYS_VARIANT_OPTIONS: Array<{
  value: KeysVariant;
  label: string;
}> = [
  { value: "stereo_xlr", label: "Stereo XLR" },
  { value: "mono_xlr", label: "Mono XLR" },
  { value: "stereo_jack", label: "Stereo jack" },
  { value: "mono_jack", label: "Mono jack" },
];

export function clampKeysCount(value: number): number {
  return Math.min(
    MAX_KEYS_COUNT,
    Math.max(MIN_KEYS_COUNT, Math.floor(value || MIN_KEYS_COUNT)),
  );
}

function keysNoteForVariant(variant: KeysVariant): string {
  return variant.endsWith("_xlr") ? KEYS_XLR_NOTE : KEYS_JACK_NOTE;
}

function isStereoVariant(variant: KeysVariant): boolean {
  return variant.startsWith("stereo_");
}

function keyForUnit(unitIndex: number, suffix?: "l" | "r"): string {
  const unit = unitIndex + 1;
  if (suffix)
    return unitIndex === 0 ? `keys_${suffix}` : `keys_${unit}_${suffix}`;
  return unitIndex === 0 ? "keys" : `keys_${unit}`;
}

function labelForUnit(
  unitIndex: number,
  totalUnits: number,
  suffix?: "L" | "R",
): string {
  const base = totalUnits === 1 ? "Keys" : `Keys ${unitIndex + 1}`;
  return suffix ? `${base} ${suffix}` : base;
}

function compactGroupKeyForUnit(unitIndex: number, variant: KeysVariant): string {
  const unit = unitIndex + 1;
  return unitIndex === 0 ? `keys_${variant}` : `keys_${unit}_${variant}`;
}

export function buildStereoInstanceInputs(
  base: InputChannel[],
  baseId: string,
  count: number,
): InputChannel[] {
  const clamped = clampKeysCount(count);
  return Array.from({ length: clamped }).flatMap((_, index) => {
    const instance = index + 1;
    const left = base.find((item) => item.key.endsWith("_l")) ?? base[0];
    const right =
      base.find((item) => item.key.endsWith("_r")) ?? base[1] ?? base[0];
    return [
      cloneWithKey(left, `${baseId}_${instance}_l`),
      cloneWithKey(right, `${baseId}_${instance}_r`),
    ];
  });
}

export function buildMonoInstanceInputs(
  input: InputChannel,
  baseId: string,
  count: number,
): InputChannel[] {
  const clamped = clampKeysCount(count);
  return Array.from({ length: clamped }).map((_, index) =>
    cloneWithKey(input, `${baseId}_${index + 1}`),
  );
}

function cloneWithKey(input: InputChannel, key: string): InputChannel {
  const channel = key.endsWith("_l") ? "L" : key.endsWith("_r") ? "R" : input.channel;
  return {
    ...input,
    key,
    ...(input.compactGroupKey ? { compactGroupKey: key.replace(/_[lr]$/i, "") } : {}),
    ...(channel ? { channel } : {}),
  };
}

export function buildKeysUnitInputs(units: KeysUnit[]): InputChannel[] {
  const normalized = normalizeKeysUnits(units);
  return normalized.flatMap((unit, index) => {
    const note = keysNoteForVariant(unit.variant);
    const baseLabel = labelForUnit(index, normalized.length);
    if (isStereoVariant(unit.variant)) {
      const compactGroupKey = compactGroupKeyForUnit(index, unit.variant);
      return [
        {
          key: keyForUnit(index, "l"),
          label: labelForUnit(index, normalized.length, "L"),
          baseLabel,
          compactGroupKey,
          channel: "L" as const,
          group: "keys" as const,
          note,
        },
        {
          key: keyForUnit(index, "r"),
          label: labelForUnit(index, normalized.length, "R"),
          baseLabel,
          compactGroupKey,
          channel: "R" as const,
          group: "keys" as const,
          note,
        },
      ];
    }
    return [
      {
        key: keyForUnit(index),
        label: labelForUnit(index, normalized.length),
        group: "keys" as const,
        note,
      },
    ];
  });
}

export function normalizeKeysUnits(units: KeysUnit[]): KeysUnit[] {
  const count = clampKeysCount(units.length);
  return Array.from({ length: count }).map((_, index) => ({
    variant: units[index]?.variant ?? DEFAULT_KEYS_VARIANT,
  }));
}

function variantFromInput(
  input: InputChannel | undefined,
  pairSize: number,
): KeysVariant {
  const note = input?.note ?? "";
  const connector = note === KEYS_JACK_NOTE ? "jack" : "xlr";
  return pairSize > 1
    ? (`stereo_${connector}` as KeysVariant)
    : (`mono_${connector}` as KeysVariant);
}

export function readKeysUnits(inputs: InputChannel[]): KeysUnit[] {
  const byIndex = new Map<number, InputChannel[]>();
  for (const input of inputs) {
    if (input.group && input.group !== "keys") continue;
    let match = /^keys_(\d+)_(l|r)$/i.exec(input.key);
    if (match) {
      const index = Number(match[1]) - 1;
      byIndex.set(index, [...(byIndex.get(index) ?? []), input]);
      continue;
    }
    match = /^keys_(l|r)$/i.exec(input.key);
    if (match) {
      byIndex.set(0, [...(byIndex.get(0) ?? []), input]);
      continue;
    }
    match = /^keys_(\d+)$/i.exec(input.key);
    if (match) {
      const index = Number(match[1]) - 1;
      byIndex.set(index, [...(byIndex.get(index) ?? []), input]);
      continue;
    }
    if (input.key === "keys") {
      byIndex.set(0, [...(byIndex.get(0) ?? []), input]);
    }
  }

  if (byIndex.size === 0) return [{ variant: DEFAULT_KEYS_VARIANT }];
  const maxIndex = Math.max(...byIndex.keys());
  return normalizeKeysUnits(
    Array.from({ length: maxIndex + 1 }).map((_, index) => {
      const group = byIndex.get(index) ?? [];
      return { variant: variantFromInput(group[0], group.length) };
    }),
  );
}
