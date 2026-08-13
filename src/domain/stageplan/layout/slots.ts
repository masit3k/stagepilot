import type { StageplanBlockSlot } from "../../model/types.js";

/** Pořadí je stabilní, aby serializace layoutu nezáležela na pořadí vstupu. */
export const STAGEPLAN_BLOCK_SLOTS: readonly StageplanBlockSlot[] = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "lead_voc_1",
  "lead_voc_2",
];

export function isStageplanBlockSlot(
  value: unknown,
): value is StageplanBlockSlot {
  return (
    typeof value === "string" &&
    (STAGEPLAN_BLOCK_SLOTS as readonly string[]).includes(value)
  );
}
