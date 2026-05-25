import type { Group } from "../model/groups.js";

type InputLike = {
  key: string;
  label: string;
  group: Group;
  note?: string;
  baseLabel?: string;
  compactGroupKey?: string;
};

function parseKeysIndex(key: string): number | null {
  if (key === "keys" || key === "keys_l" || key === "keys_r") return 1;
  const match = /^keys_(\d+)(?:_[lr])?$/i.exec(key);
  if (!match) return null;
  return Number(match[1] ?? "1");
}

function buildLabel(index: number, total: number): string {
  return total <= 1 ? "Keys" : `Keys ${index}`;
}

export function formatKeysInputInstances<T extends InputLike>(
  inputs: T[],
): T[] {
  let total = 0;
  for (const input of inputs) {
    if (input.group !== "keys") continue;
    const index = parseKeysIndex(input.key);
    if (!index) continue;
    total = Math.max(total, index);
  }
  return inputs.map((input) => {
    if (input.group !== "keys") return input;
    const index = parseKeysIndex(input.key);
    if (!index) return input;
    const label = buildLabel(index, total);
    return {
      ...input,
      label,
      ...(input.compactGroupKey ? { baseLabel: label } : {}),
    };
  });
}
