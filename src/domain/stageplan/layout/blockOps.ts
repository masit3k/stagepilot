import type { StageplanBlock, StageplanStageSize } from "../../model/types.js";
import { roundDeg, roundM } from "./round.js";

export const SNAP_STEP_M = 0.1;
export const SNAP_STEP_DEG = 15;
/** Pódia bývají nepravidelná, takže blok smí kousek přesahovat za hranu. */
export const OVERHANG_TOLERANCE_M = 0.2;
/** Nejmenší rozumná lidská zóna — stojan s mikrofonem. Ne tisková mez (R7). */
export const MIN_ZONE_M = 0.8;

export type ZoneHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

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

export function snapM(value: number): number {
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

/** Kterou hranu úchyt táhne: +1 doprava/dolů, −1 doleva/nahoru, 0 vůbec. */
function handleSigns(handle: ZoneHandle): { signX: number; signY: number } {
  return {
    signX: handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0,
    signY: handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0,
  };
}

function resizedExtent(current: number, growth: number, snap: boolean): number {
  const target = current + growth;
  return Math.max(MIN_ZONE_M, snap ? snapM(target) : roundM(target));
}

/**
 * Táhne se jedna hrana (nebo dvě u rohu) a **protilehlá stojí**, takže se mění
 * i střed zóny. `deltaM` je posun kurzoru od začátku gesta v souřadnicích
 * pódia; u otočené zóny se nejdřív promítne do jejích vlastních os, tam se
 * spočítá nový rozměr, a posun středu se otočí zpátky. Bez té projekce by
 * úchyt na otočeném bloku táhl podél osy pódia a hrana by ujížděla do strany (R8).
 *
 * Pořadí je snap → podlaha → clamp, stejně jako `moveBlockTo` dělá
 * snap → clamp: mřížka ustupuje hraně pódia, ne naopak.
 */
export function resizeBlockTo(
  block: StageplanBlock,
  handle: ZoneHandle,
  deltaM: { readonly xM: number; readonly yM: number },
  options: { readonly area: StageplanStageSize; readonly snap: boolean },
): StageplanBlock {
  const radians = (block.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const { signX, signY } = handleSigns(handle);

  const localXM = deltaM.xM * cos + deltaM.yM * sin;
  const localYM = -deltaM.xM * sin + deltaM.yM * cos;

  const widthM = resizedExtent(block.widthM, signX * localXM, options.snap);
  const depthM = resizedExtent(block.depthM, signY * localYM, options.snap);

  // Střed jde o polovinu skutečného přírůstku ve směru tažené hrany.
  const shiftXM = (signX * (widthM - block.widthM)) / 2;
  const shiftYM = (signY * (depthM - block.depthM)) / 2;

  return clampToArea(
    {
      ...block,
      widthM,
      depthM,
      centerXM: roundM(block.centerXM + shiftXM * cos - shiftYM * sin),
      centerYM: roundM(block.centerYM + shiftXM * sin + shiftYM * cos),
    },
    options.area,
  );
}
