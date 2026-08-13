import type { StageplanBlock, StageplanStageSize } from "../../model/types.js";
import { roundDeg, roundM } from "./round.js";

export const SNAP_STEP_M = 0.1;
export const SNAP_STEP_DEG = 15;
/** Pódia bývají nepravidelná, takže blok smí kousek přesahovat za hranu. */
export const OVERHANG_TOLERANCE_M = 0.2;

type Zone = Pick<StageplanBlock, "widthM" | "depthM" | "rotationDeg">;

/** Poloosy opsaného obdélníku otočené zóny — clamp musí počítat s rotací. */
export function rotatedHalfExtents(zone: Zone): {
  halfXM: number;
  halfYM: number;
} {
  const radians = (zone.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    halfXM: (zone.widthM * cos + zone.depthM * sin) / 2,
    halfYM: (zone.widthM * sin + zone.depthM * cos) / 2,
  };
}

function clampAxis(value: number, halfM: number, extentM: number): number {
  const min = halfM - OVERHANG_TOLERANCE_M;
  const max = extentM - halfM + OVERHANG_TOLERANCE_M;
  // Zóna širší než plocha: pinovat ji k jedné hraně by lhalo, patří na střed.
  if (min > max) return extentM / 2;
  return Math.min(Math.max(value, min), max);
}

export function clampToArea(
  block: StageplanBlock,
  area: StageplanStageSize,
): StageplanBlock {
  const { halfXM, halfYM } = rotatedHalfExtents(block);
  return {
    ...block,
    centerXM: roundM(clampAxis(block.centerXM, halfXM, area.widthM)),
    centerYM: roundM(clampAxis(block.centerYM, halfYM, area.depthM)),
  };
}

function snapM(value: number): number {
  return roundM(Math.round(value / SNAP_STEP_M) * SNAP_STEP_M);
}

/**
 * Pořadí je snap → clamp → zaokrouhlení. Blok opřený o hranu proto nemusí
 * ležet na mřížce; to je správně, hrana pódia má přednost před mřížkou.
 */
export function moveBlockTo(
  block: StageplanBlock,
  target: { readonly centerXM: number; readonly centerYM: number },
  options: { readonly area: StageplanStageSize; readonly snap: boolean },
): StageplanBlock {
  const next = options.snap
    ? { centerXM: snapM(target.centerXM), centerYM: snapM(target.centerYM) }
    : { centerXM: roundM(target.centerXM), centerYM: roundM(target.centerYM) };
  return clampToArea({ ...block, ...next }, options.area);
}

/** Klávesnice posouvá o přesný krok, takže se na mřížku nesnapuje. */
export function nudgeBlockBy(
  block: StageplanBlock,
  delta: { readonly xM: number; readonly yM: number },
  options: { readonly area: StageplanStageSize },
): StageplanBlock {
  return clampToArea(
    {
      ...block,
      centerXM: roundM(block.centerXM + delta.xM),
      centerYM: roundM(block.centerYM + delta.yM),
    },
    options.area,
  );
}

export function rotateBlockTo(
  block: StageplanBlock,
  deg: number,
  options: { readonly area: StageplanStageSize; readonly snap: boolean },
): StageplanBlock {
  const snapped = options.snap
    ? Math.round(deg / SNAP_STEP_DEG) * SNAP_STEP_DEG
    : deg;
  // Otočení zvětší opsaný obdélník, takže blok u hrany se musí vrátit na plochu.
  return clampToArea(
    { ...block, rotationDeg: roundDeg(snapped) },
    options.area,
  );
}

export function rotateBlockBy(
  block: StageplanBlock,
  deltaDeg: number,
  options: { readonly area: StageplanStageSize; readonly snap: boolean },
): StageplanBlock {
  return rotateBlockTo(block, block.rotationDeg + deltaDeg, options);
}
