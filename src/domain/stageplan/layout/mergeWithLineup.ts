import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanLayout,
  StageplanStageSize,
} from "../../model/types.js";
import { buildDefaultLayout } from "./defaultLayout.js";
import { STAGEPLAN_BLOCK_SLOTS } from "./slots.js";

/**
 * Doplní bloky pro nové sloty, odebere bloky slotů, které z lineupu zmizely, a
 * existující nechá beze změny — včetně pozice, rotace i rozměru. Výměna
 * kytaristy nesmí přerovnat plán.
 */
export function mergeWithLineup(
  existing: StageplanLayout | undefined,
  args: {
    readonly slots: readonly StageplanBlockSlot[];
    readonly stage: StageplanStageSize | null;
  },
): StageplanLayout {
  if (!existing) return buildDefaultLayout(args);

  const keptBySlot = new Map<StageplanBlockSlot, StageplanBlock>(
    existing.blocks.map((block) => [block.slot, block]),
  );
  const defaults = buildDefaultLayout({
    slots: args.slots,
    stage: existing.stage,
  });
  const defaultBySlot = new Map<StageplanBlockSlot, StageplanBlock>(
    defaults.blocks.map((block) => [block.slot, block]),
  );

  const blocks = STAGEPLAN_BLOCK_SLOTS.flatMap((slot) => {
    if (!args.slots.includes(slot)) return [];
    const kept = keptBySlot.get(slot);
    if (kept) return [kept];
    const fresh = defaultBySlot.get(slot);
    return fresh ? [fresh] : [];
  });

  return { stage: existing.stage, blocks };
}
