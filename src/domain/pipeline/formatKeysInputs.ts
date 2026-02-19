import type { Group } from "../model/groups.js";

type InputLike = { key: string; label: string; group: Group; note?: string };

type Kind = "keys" | "synth" | "synth_mono";

function parseKindAndIndex(key: string): { kind: Kind; index: number } | null {
  const match = /^(keys|synth|synth_mono)(?:_(\d+))?(?:_[lr])?$/i.exec(key);
  if (!match) return null;
  return { kind: match[1].toLowerCase() as Kind, index: Number(match[2] ?? "1") };
}

function buildLabel(kind: Kind, index: number, total: number): string {
  if (kind === "keys") return total <= 1 ? "Keys" : `Keys ${index}`;
  if (kind === "synth") return total <= 1 ? "Synth" : `Synth ${index}`;
  return total <= 1 ? "Synth (mono)" : `Synth (mono) ${index}`;
}

export function formatKeysInputInstances<T extends InputLike>(inputs: T[]): T[] {
  const totals: Record<Kind, number> = { keys: 0, synth: 0, synth_mono: 0 };
  for (const input of inputs) {
    if (input.group !== "keys") continue;
    const parsed = parseKindAndIndex(input.key);
    if (!parsed) continue;
    totals[parsed.kind] = Math.max(totals[parsed.kind], parsed.index);
  }
  return inputs.map((input) => {
    if (input.group !== "keys") return input;
    const parsed = parseKindAndIndex(input.key);
    if (!parsed) return input;
    return { ...input, label: buildLabel(parsed.kind, parsed.index, totals[parsed.kind]) };
  });
}
