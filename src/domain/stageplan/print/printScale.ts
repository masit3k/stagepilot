import type { StageplanBlock, StageplanStageSize } from "../../model/types.js";
import { OVERHANG_TOLERANCE_M } from "../layout/blockOps.js";
import { NOMINAL_STAGE } from "../layout/defaultLayout.js";
import type { PrintFootprintMm } from "./printFootprint.js";

export type PrintArea = {
  readonly widthMm: number;
  readonly heightMm: number;
};

export type PrintScale = {
  readonly mmPerM: number;
  readonly planWidthMm: number;
  readonly planHeightMm: number;
  readonly toMm: (meters: number) => number;
  readonly toM: (millimeters: number) => number;
};

/**
 * Sestaví `PrintScale` z rozměru pódia a `mmPerM` — jediné místo, které to dělá,
 * aby konstrukce nemohla rozejít mezi voláními.
 *
 * Měřítko je jedno pro obě osy. V neizotropním by se otočená zóna kreslila jako
 * zkosený rovnoběžník a vytištěný údaj o rotaci by lhal — a rotace je přesně to,
 * co F5b tiskne.
 */
function buildPrintScale(plan: StageplanStageSize, mmPerM: number): PrintScale {
  return {
    mmPerM,
    planWidthMm: plan.widthM * mmPerM,
    planHeightMm: plan.depthM * mmPerM,
    toMm: (meters) => meters * mmPerM,
    toM: (millimeters) => millimeters / mmPerM,
  };
}

export type PrintScaleBlock = {
  readonly zoneWidthM: number;
  readonly zoneDepthM: number;
  readonly boxWidthMm: number;
  readonly boxHeightMm: number;
};

/**
 * Spáruje zónu se stopou boxu. Jediné místo, kde se osy párují — prohození
 * `widthMm` a `heightMm` je přesně ta chyba, kterou tenhle typ jinak nechává
 * projít bez povšimnutí.
 */
export function toPrintScaleBlock(args: {
  readonly zone: Pick<StageplanBlock, "widthM" | "depthM">;
  readonly footprint: PrintFootprintMm;
}): PrintScaleBlock {
  return {
    zoneWidthM: args.zone.widthM,
    zoneDepthM: args.zone.depthM,
    boxWidthMm: args.footprint.widthMm,
    boxHeightMm: args.footprint.heightMm,
  };
}

/**
 * Největší `s`, při kterém se do plochy vejde pódium s tolerancí i přesah
 * jednoho boxu přes jeho zónu:
 *
 *   inflatedM·s + max(0, boxMm − zonaM·s) ≤ plochaMm
 *
 * Levá strana v `s` roste, takže stačí ověřit přerůstání při horní mezi: když
 * se box do zóny vejde tam, vejde se i při každém menším `s`. Uzavřený tvar,
 * bez iterace a bez binárního hledání.
 */
function reservedMmPerM(args: {
  readonly bound: number;
  readonly inflatedM: number;
  readonly areaMm: number;
  readonly zoneM: number;
  readonly boxMm: number;
}): number {
  const { bound, inflatedM, areaMm, zoneM, boxMm } = args;
  if (boxMm <= zoneM * bound) return bound;

  const denominator = inflatedM - zoneM;
  // Pódium užší než zóna i s tolerancí: rezervovat nejde, pojistka to chytí.
  if (denominator <= 0) return bound;

  const candidate = (areaMm - boxMm) / denominator;
  // Box větší než celá plocha: rezerva by vyšla záporná. Vrátit mez a nechat
  // spadnout pojistku, která umí pojmenovat viníka (R5).
  if (candidate <= 0) return bound;

  return Math.min(bound, candidate);
}

/**
 * Měřítko, do kterého se vejde i to, co smí přesahovat hranu pódia: clamp v
 * editoru nechává blok přesahovat o `OVERHANG_TOLERANCE_M` a tištěný box je
 * navíc velký podle svého textu, ne podle zóny (R3). Rezerva se proto počítá
 * **pro každý blok zvlášť a v obou osách** (R6) — svislá osa ji dřív neměla
 * vůbec, což byla skrytá díra: vysoký box u horní hrany pódia plochu přerostl
 * a rozpočet o tom nevěděl.
 *
 * Rotace do rezervy nevstupuje (stejně jako dřív); otočený box má větší opsaný
 * obdélník a chytá ho až kontrola union bboxu v rendereru.
 */
export function resolvePrintScale(args: {
  readonly stage: StageplanStageSize | null;
  readonly blocks: readonly PrintScaleBlock[];
  readonly area: PrintArea;
}): PrintScale {
  const { stage, blocks, area } = args;
  const plan = stage ?? NOMINAL_STAGE;
  const inflatedWidthM = plan.widthM + 2 * OVERHANG_TOLERANCE_M;
  const inflatedDepthM = plan.depthM + 2 * OVERHANG_TOLERANCE_M;

  const widthBound = area.widthMm / inflatedWidthM;
  const heightBound = area.heightMm / inflatedDepthM;

  let mmPerM = Math.min(widthBound, heightBound);
  for (const block of blocks) {
    mmPerM = Math.min(
      mmPerM,
      reservedMmPerM({
        bound: widthBound,
        inflatedM: inflatedWidthM,
        areaMm: area.widthMm,
        zoneM: block.zoneWidthM,
        boxMm: block.boxWidthMm,
      }),
      reservedMmPerM({
        bound: heightBound,
        inflatedM: inflatedDepthM,
        areaMm: area.heightMm,
        zoneM: block.zoneDepthM,
        boxMm: block.boxHeightMm,
      }),
    );
  }

  return buildPrintScale(plan, mmPerM);
}
