import type { Group } from "../model/groups.js";
import { formatVocalLabel } from "./vocals.js";

type DisplayInput = {
  key: string;
  label: string;
  group: Group;
};

type DrumFamily = "kick" | "snare" | "tom" | "floor";

type DrumFamilyMember = {
  family: DrumFamily;
  index: number;
};

export type DrumFamilyState = Record<DrumFamily, Set<number>>;

function parseDrumFamilyMember(key: string): DrumFamilyMember | null {
  const kick = /^dr_kick_(\d+)_(out|in)$/i.exec(key);
  if (kick) return { family: "kick", index: Number(kick[1]) };

  const snare = /^dr_snare(\d+)_(top|bottom)$/i.exec(key);
  if (snare) return { family: "snare", index: Number(snare[1]) };

  const tom = /^dr_tom_(\d+)$/i.exec(key);
  if (tom) return { family: "tom", index: Number(tom[1]) };

  const floor = /^dr_floor_(\d+)$/i.exec(key);
  if (floor) return { family: "floor", index: Number(floor[1]) };

  return null;
}

export function groupActiveDrumInputsByFamily(inputs: DisplayInput[]): DrumFamilyState {
  const grouped: DrumFamilyState = {
    kick: new Set<number>(),
    snare: new Set<number>(),
    tom: new Set<number>(),
    floor: new Set<number>(),
  };

  for (const input of inputs) {
    if (input.group !== "drums") continue;
    const member = parseDrumFamilyMember(input.key);
    if (!member) continue;
    grouped[member.family].add(member.index);
  }

  return grouped;
}

export function shouldShowIndexedDrumFamily(state: DrumFamilyState, family: DrumFamily): boolean {
  return state[family].size > 1;
}

export function formatDrumInputDisplayLabel(input: DisplayInput, state: DrumFamilyState): string {
  const kick = /^dr_kick_(\d+)_(out|in)$/i.exec(input.key);
  if (kick) {
    const showIndex = shouldShowIndexedDrumFamily(state, "kick");
    const side = kick[2].toUpperCase();
    return showIndex ? `Kick ${kick[1]} ${side}` : `Kick ${side}`;
  }

  const snare = /^dr_snare(\d+)_(top|bottom)$/i.exec(input.key);
  if (snare) {
    const showIndex = shouldShowIndexedDrumFamily(state, "snare");
    const side = snare[2].toUpperCase();
    return showIndex ? `Snare ${snare[1]} ${side}` : `Snare ${side}`;
  }

  const tom = /^dr_tom_(\d+)$/i.exec(input.key);
  if (tom) {
    const showIndex = shouldShowIndexedDrumFamily(state, "tom");
    return showIndex ? `Tom ${tom[1]}` : "Tom";
  }

  const floor = /^dr_floor_(\d+)$/i.exec(input.key);
  if (floor) {
    const showIndex = shouldShowIndexedDrumFamily(state, "floor");
    return showIndex ? `Floor ${floor[1]}` : "Floor";
  }

  return input.label;
}

export function formatLeadVocalDisplayLabel(args: {
  key: string;
  fallbackLabel: string;
  leadCount: number;
  leadGenderByIndex: Array<string | undefined>;
}): string {
  const indexMatch = /voc_lead_(\d+)/i.exec(args.key);
  const index = indexMatch ? Number(indexMatch[1]) : 1;

  if (!args.key.startsWith("voc_lead")) return args.fallbackLabel;

  return formatVocalLabel({
    role: "lead",
    index,
    gender: args.leadGenderByIndex[index - 1],
    leadCount: args.leadCount,
    multiLeadStyle: "input_list_upper_suffix",
  });
}
