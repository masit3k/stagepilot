import type { StageplanBlockSlot } from "../../../../../../src/domain/model/types";

/** Popisek bloku na ploše. Mono, uppercase — jako tiskové slotové hlavičky. */
export const LABEL_BY_SLOT: Readonly<Record<StageplanBlockSlot, string>> = {
  drums: "DRUMS",
  bass: "BASS",
  guitar: "EL. GUITAR",
  keys: "KEYS",
  lead_voc_1: "LEAD VOC 1",
  lead_voc_2: "LEAD VOC 2",
};

export function formatMeters(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} m`;
}

export function formatZone(widthM: number, depthM: number): string {
  return `${formatMeters(widthM)} × ${formatMeters(depthM)}`;
}
