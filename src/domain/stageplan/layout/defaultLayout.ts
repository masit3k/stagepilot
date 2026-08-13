import type {
  StageplanBlockSlot,
  StageplanLayout,
  StageplanStageSize,
} from "../../model/types.js";
import { roundM } from "./round.js";
import { STAGEPLAN_BLOCK_SLOTS } from "./slots.js";

/** Kreslicí plocha projektu, který rozměr pódia nezadal. */
export const NOMINAL_STAGE: StageplanStageSize = { widthM: 12, depthM: 8 };

/** Kolik místa muzikant na pódiu zabere s backlinem. Odvozeno z prototypu 3g. */
export const ZONE_BY_SLOT: Readonly<
  Record<
    StageplanBlockSlot,
    { readonly widthM: number; readonly depthM: number }
  >
> = {
  drums: { widthM: 2.8, depthM: 1.6 },
  bass: { widthM: 2.7, depthM: 1.4 },
  guitar: { widthM: 2.7, depthM: 1.4 },
  keys: { widthM: 2.8, depthM: 1.4 },
  lead_voc_1: { widthM: 2.6, depthM: 1.2 },
  lead_voc_2: { widthM: 2.6, depthM: 1.2 },
};

type Center = { readonly xM: number; readonly yM: number };

/** Pět bloků: kopie dnešního `layout_5_party`, dolní řada o třech sloupcích. */
const CENTER_5: Readonly<Record<StageplanBlockSlot, Center>> = {
  drums: { xM: 6, yM: 1.2 },
  bass: { xM: 9.4, yM: 1.2 },
  guitar: { xM: 2.6, yM: 5.5 },
  keys: { xM: 9.4, yM: 5.5 },
  lead_voc_1: { xM: 6, yM: 5.5 },
  /** Ve pětiblokové variantě neexistuje; hodnota je tu jen pro úplnost tabulky. */
  lead_voc_2: { xM: 7.5, yM: 5.5 },
};

/** Šest bloků: kopie dnešního `layout_6_2_vocs`, dolní řada o čtyřech sloupcích. */
const CENTER_6: Readonly<Record<StageplanBlockSlot, Center>> = {
  drums: { xM: 6, yM: 1.2 },
  bass: { xM: 9.4, yM: 1.2 },
  guitar: { xM: 1.5, yM: 5.5 },
  keys: { xM: 10.5, yM: 5.5 },
  lead_voc_1: { xM: 4.5, yM: 5.5 },
  lead_voc_2: { xM: 7.5, yM: 5.5 },
};

/**
 * Deterministické výchozí rozmístění. `Reset rozmístění` je jen další zavolání
 * téhle funkce — proto v ní nesmí být nic náhodného ani závislého na času.
 */
export function buildDefaultLayout(args: {
  readonly slots: readonly StageplanBlockSlot[];
  readonly stage: StageplanStageSize | null;
}): StageplanLayout {
  const table = args.slots.includes("lead_voc_2") ? CENTER_6 : CENTER_5;
  const area = args.stage ?? NOMINAL_STAGE;
  const scaleX = area.widthM / NOMINAL_STAGE.widthM;
  const scaleY = area.depthM / NOMINAL_STAGE.depthM;

  const blocks = STAGEPLAN_BLOCK_SLOTS.flatMap((slot) => {
    if (!args.slots.includes(slot)) return [];
    return [
      {
        slot,
        centerXM: roundM(table[slot].xM * scaleX),
        centerYM: roundM(table[slot].yM * scaleY),
        widthM: ZONE_BY_SLOT[slot].widthM,
        depthM: ZONE_BY_SLOT[slot].depthM,
        rotationDeg: 0,
      },
    ];
  });

  return { stage: args.stage, blocks };
}
