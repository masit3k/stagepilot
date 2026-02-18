import type { InputChannel } from "../../../../../../../../src/domain/model/types";

export const MIN_KEYS_COUNT = 1;
export const MAX_KEYS_COUNT = 3;

export function clampKeysCount(value: number): number {
  return Math.min(MAX_KEYS_COUNT, Math.max(MIN_KEYS_COUNT, Math.floor(value || MIN_KEYS_COUNT)));
}

function cloneWithKey(input: InputChannel, key: string): InputChannel {
  return { ...input, key };
}

export function buildStereoInstanceInputs(base: InputChannel[], baseId: string, count: number): InputChannel[] {
  const clamped = clampKeysCount(count);
  return Array.from({ length: clamped }).flatMap((_, index) => {
    const instance = index + 1;
    const left = base.find((item) => item.key.endsWith("_l")) ?? base[0];
    const right = base.find((item) => item.key.endsWith("_r")) ?? base[1] ?? base[0];
    return [
      cloneWithKey(left, `${baseId}_${instance}_l`),
      cloneWithKey(right, `${baseId}_${instance}_r`),
    ];
  });
}

export function buildMonoInstanceInputs(input: InputChannel, baseId: string, count: number): InputChannel[] {
  const clamped = clampKeysCount(count);
  return Array.from({ length: clamped }).map((_, index) => cloneWithKey(input, `${baseId}_${index + 1}`));
}
