import type { StageplanBlockSlot } from "../../model/types.js";
import { STAGEPLAN_BLOCK_SLOTS } from "./slots.js";

const INSTRUMENT_GROUPS = ["drums", "bass", "guitar", "keys"] as const;

type InstrumentGroup = (typeof INSTRUMENT_GROUPS)[number];

/**
 * Které bloky stage plan má. Pravidlo je stejné, jakým dnes tiskový model
 * obsazuje slot `lead_voc_1` a `lead_voc_2`: zpěvák, který už drží nástroj,
 * druhý blok nedostane.
 */
export function resolveStageplanBlockSlots(args: {
  readonly musicianIdsByGroup: Readonly<
    Partial<Record<InstrumentGroup, readonly string[]>>
  >;
  readonly leadVocalIds: readonly string[];
}): StageplanBlockSlot[] {
  const present = new Set<StageplanBlockSlot>();
  const instrumentIds = new Set<string>();

  for (const group of INSTRUMENT_GROUPS) {
    const ids = args.musicianIdsByGroup[group] ?? [];
    if (ids.length > 0) present.add(group);
    for (const id of ids) instrumentIds.add(id);
  }

  const freeLeads = args.leadVocalIds.filter((id) => !instrumentIds.has(id));
  if (freeLeads.length > 0) present.add("lead_voc_1");
  if (freeLeads.length > 1) present.add("lead_voc_2");

  return STAGEPLAN_BLOCK_SLOTS.filter((slot) => present.has(slot));
}
