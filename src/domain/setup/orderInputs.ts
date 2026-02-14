import { drumRankByResolvedKey } from "../drums/resolveDrumInputs.js";
import { GROUP_ORDER, type Group } from "../model/groups.js";
import type { InputChannel } from "../model/types.js";

function groupRank(group?: Group): number {
  if (!group) return GROUP_ORDER.length;
  const idx = GROUP_ORDER.indexOf(group);
  return idx === -1 ? GROUP_ORDER.length : idx;
}

function sortWithinGroup(group: Group | undefined, a: InputChannel, b: InputChannel): number {
  if (group === "drums") {
    const drumRank = drumRankByResolvedKey(a.key) - drumRankByResolvedKey(b.key);
    if (drumRank !== 0) return drumRank;
  }
  return a.key.localeCompare(b.key);
}

export function orderInputs(
  inputs: InputChannel[],
  defaultGroup?: Group,
): InputChannel[] {
  return [...inputs].sort((a, b) => {
    const aGroup = (a.group ?? defaultGroup) as Group | undefined;
    const bGroup = (b.group ?? defaultGroup) as Group | undefined;
    const rank = groupRank(aGroup) - groupRank(bGroup);
    if (rank !== 0) return rank;
    return sortWithinGroup(aGroup, a, b);
  });
}
