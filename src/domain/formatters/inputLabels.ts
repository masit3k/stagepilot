import { getDrumCatalogItemByKey } from "../drums/drumInputCatalog.js";
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
  position?: "in" | "out" | "top" | "bottom";
};

export type DrumFamilyState = Record<DrumFamily, Set<number>>;

function parseDrumFamilyMember(key: string): DrumFamilyMember | null {
  const catalogItem = getDrumCatalogItemByKey(key);
  if (!catalogItem) return null;

  if (catalogItem.category === "kick" && catalogItem.index) {
    return { family: "kick", index: catalogItem.index, position: catalogItem.position };
  }
  if (catalogItem.category === "snare" && catalogItem.index) {
    return { family: "snare", index: catalogItem.index, position: catalogItem.position };
  }
  if (catalogItem.category === "tom" && catalogItem.index) {
    return { family: "tom", index: catalogItem.index };
  }
  if (catalogItem.category === "floorTom" && catalogItem.index) {
    return { family: "floor", index: catalogItem.index };
  }

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
  const catalogItem = getDrumCatalogItemByKey(input.key);
  if (!catalogItem) return input.label;

  if (catalogItem.category === "kick" && catalogItem.position) {
    const showIndex = shouldShowIndexedDrumFamily(state, "kick");
    const side = catalogItem.position.toUpperCase();
    return showIndex && catalogItem.index ? `Kick ${catalogItem.index} ${side}` : `Kick ${side}`;
  }

  if (catalogItem.category === "snare" && catalogItem.position) {
    const showIndex = shouldShowIndexedDrumFamily(state, "snare");
    const side = catalogItem.position.toUpperCase();
    return showIndex && catalogItem.index ? `Snare ${catalogItem.index} ${side}` : `Snare ${side}`;
  }

  if (catalogItem.category === "tom") {
    const showIndex = shouldShowIndexedDrumFamily(state, "tom");
    return showIndex && catalogItem.index ? `Tom ${catalogItem.index}` : "Tom";
  }

  if (catalogItem.category === "floorTom") {
    const showIndex = shouldShowIndexedDrumFamily(state, "floor");
    return showIndex && catalogItem.index ? `Floor ${catalogItem.index}` : "Floor";
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
  });
}
