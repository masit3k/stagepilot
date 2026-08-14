import type {
  StageplanBlock,
  StageplanBlockSlot,
} from "../../../../../../src/domain/model/types";

/** Popisek bloku na ploše. Mono, uppercase — jako tiskové slotové hlavičky. */
export const LABEL_BY_SLOT: Readonly<Record<StageplanBlockSlot, string>> = {
  drums: "DRUMS",
  bass: "BASS",
  guitar: "EL. GUITAR",
  keys: "KEYS",
  lead_voc_1: "LEAD VOC 1",
  lead_voc_2: "LEAD VOC 2",
};

/** Rozhraní je anglicky, takže desetinná tečka. V PDF se sází čárka (R14). */
export function formatMeters(value: number): string {
  return `${value.toFixed(1)} m`;
}

export function formatZone(widthM: number, depthM: number): string {
  return `${formatMeters(widthM)} × ${formatMeters(depthM)}`;
}

export function formatScale(mmPerM: number): string {
  return `${mmPerM.toFixed(1)} mm/m`;
}

/**
 * Nejužší zóna určuje tiskové měřítko přes rezervu v `resolvePrintScale`, takže
 * když se měřítko změní, tenhle blok za tím stojí. Bez pojmenování je číslo
 * měřítka k ničemu (R10).
 */
export function narrowestZoneSlot(
  blocks: readonly StageplanBlock[],
): StageplanBlockSlot | null {
  let narrowest: StageplanBlock | null = null;
  for (const block of blocks) {
    if (!narrowest || block.widthM < narrowest.widthM) narrowest = block;
  }
  return narrowest?.slot ?? null;
}
