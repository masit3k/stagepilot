import type {
  StageplanBlock,
  StageplanLayout,
  StageplanStageSize,
} from "../../model/types.js";
import { isStageplanBlockSlot } from "./slots.js";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const numeric = finiteNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function normalizeRotation(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

function normalizeStage(value: unknown): StageplanStageSize | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { widthM?: unknown; depthM?: unknown };
  const widthM = positiveNumber(raw.widthM);
  const depthM = positiveNumber(raw.depthM);
  if (widthM === null || depthM === null) return null;
  return { widthM, depthM };
}

function normalizeBlock(value: unknown): StageplanBlock | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!isStageplanBlockSlot(raw.slot)) return null;
  const centerXM = finiteNumber(raw.centerXM);
  const centerYM = finiteNumber(raw.centerYM);
  const widthM = positiveNumber(raw.widthM);
  const depthM = positiveNumber(raw.depthM);
  const rotationDeg = finiteNumber(raw.rotationDeg);
  if (
    centerXM === null ||
    centerYM === null ||
    widthM === null ||
    depthM === null ||
    rotationDeg === null
  ) {
    return null;
  }
  return {
    slot: raw.slot,
    centerXM,
    centerYM,
    widthM,
    depthM,
    rotationDeg: normalizeRotation(rotationDeg),
  };
}

/**
 * Poškozený layout se zahazuje, ne vyhazuje výjimku — projekt se musí dát
 * otevřít i po ruční editaci JSONu. Chybějící layout je legitimní stav.
 */
export function normalizeStageplanLayout(
  value: unknown,
): StageplanLayout | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { stage?: unknown; blocks?: unknown };
  if (!Array.isArray(raw.blocks)) return undefined;

  const seen = new Set<string>();
  const blocks: StageplanBlock[] = [];
  for (const entry of raw.blocks) {
    const block = normalizeBlock(entry);
    if (!block || seen.has(block.slot)) continue;
    seen.add(block.slot);
    blocks.push(block);
  }
  return { stage: normalizeStage(raw.stage), blocks };
}
