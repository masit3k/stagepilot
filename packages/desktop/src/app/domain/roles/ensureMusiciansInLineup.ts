import type { Group } from "../../../../../../src/domain/model/groups";
import {
  type LineupMap,
  type LineupSlotValue,
  normalizeLineupSlots,
} from "../../../projectRules";

const LINEUP_GROUPS = ["drums", "bass", "guitar", "keys", "vocs"] as const;
type LineupGroup = (typeof LINEUP_GROUPS)[number];

type MusicianLineupIdentity = {
  group: Group;
};

function isLineupGroup(group: Group): group is LineupGroup {
  return (LINEUP_GROUPS as readonly Group[]).includes(group);
}

function normalizeSlots(value: LineupMap[string]): LineupSlotValue[] {
  return normalizeLineupSlots(value, Number.POSITIVE_INFINITY);
}

export function ensureMusiciansInLineup(
  lineup: LineupMap,
  musiciansById: ReadonlyMap<string, MusicianLineupIdentity>,
  musicianIds: readonly string[],
): LineupMap {
  const occupiedIds = new Set<string>();
  for (const role of LINEUP_GROUPS) {
    for (const slot of normalizeSlots(lineup[role])) {
      occupiedIds.add(slot.musicianId);
    }
  }

  let nextLineup = lineup;
  const nextSlotsByRole = new Map<LineupGroup, LineupSlotValue[]>();

  for (const rawMusicianId of musicianIds) {
    const musicianId = rawMusicianId.trim();
    if (!musicianId || occupiedIds.has(musicianId)) continue;

    const musician = musiciansById.get(musicianId);
    if (!musician || !isLineupGroup(musician.group)) continue;

    const currentSlots =
      nextSlotsByRole.get(musician.group) ??
      normalizeSlots(nextLineup[musician.group]);
    const nextSlots = [...currentSlots, { musicianId }];
    nextSlotsByRole.set(musician.group, nextSlots);
    nextLineup = {
      ...nextLineup,
      [musician.group]: nextSlots,
    };
    occupiedIds.add(musicianId);
  }

  return nextLineup;
}
