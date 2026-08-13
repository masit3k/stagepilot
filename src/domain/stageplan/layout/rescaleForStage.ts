import type { StageplanLayout, StageplanStageSize } from "../../model/types.js";
import { clampToArea } from "./blockOps.js";
import { NOMINAL_STAGE } from "./defaultLayout.js";
import { roundM } from "./round.js";

/**
 * Volá se **výhradně** při explicitní změně rozměru pódia, nikdy při načtení.
 * Pozice drží tvar rozestavění, rozměry zón se nemění — na malém pódiu se tedy
 * zóny mohou překrývat, což je pravdivá informace, ne chyba k uklizení.
 */
export function rescaleForStage(
  layout: StageplanLayout,
  nextStage: StageplanStageSize | null,
): StageplanLayout {
  const from = layout.stage ?? NOMINAL_STAGE;
  const to = nextStage ?? NOMINAL_STAGE;
  const scaleX = to.widthM / from.widthM;
  const scaleY = to.depthM / from.depthM;

  const blocks = layout.blocks.map((block) =>
    clampToArea(
      {
        ...block,
        centerXM: roundM(block.centerXM * scaleX),
        centerYM: roundM(block.centerYM * scaleY),
      },
      to,
    ),
  );

  return { stage: nextStage, blocks };
}
