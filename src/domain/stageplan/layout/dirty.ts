import type { StageplanLayout } from "../../model/types.js";
import { roundDeg, roundM } from "./round.js";

/**
 * Porovnává zaokrouhlené hodnoty a nezávisle na pořadí bloků, takže dirty
 * stav nezapne float šum z tažení ani přeskládané pole.
 */
function serialize(layout: StageplanLayout | undefined): string {
  if (!layout) return "";
  const stage = layout.stage
    ? `${roundM(layout.stage.widthM)}x${roundM(layout.stage.depthM)}`
    : "none";
  const blocks = [...layout.blocks]
    .sort((a, b) => a.slot.localeCompare(b.slot))
    .map((block) =>
      [
        block.slot,
        roundM(block.centerXM),
        roundM(block.centerYM),
        roundM(block.widthM),
        roundM(block.depthM),
        roundDeg(block.rotationDeg),
      ].join(","),
    )
    .join("|");
  return `${stage}#${blocks}`;
}

export function isStageplanLayoutDirty(
  initial: StageplanLayout | undefined,
  current: StageplanLayout,
): boolean {
  return serialize(initial) !== serialize(current);
}
