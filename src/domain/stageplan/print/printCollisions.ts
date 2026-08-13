import type { StageplanBlockSlot } from "../../model/types.js";

/** Milimetrová tolerance: dotyk hran není překryv. */
const EPSILON_MM = 0.01;

export type PrintRect = {
  readonly slot: StageplanBlockSlot;
  readonly centerXMm: number;
  readonly centerYMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly rotationDeg: number;
};

type Point = { readonly x: number; readonly y: number };

function corners(rect: PrintRect): Point[] {
  const radians = (rect.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfW = rect.widthMm / 2;
  const halfH = rect.heightMm / 2;

  return [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ].map((point) => ({
    x: rect.centerXMm + point.x * cos - point.y * sin,
    y: rect.centerYMm + point.x * sin + point.y * cos,
  }));
}

function axes(rect: PrintRect): Point[] {
  const radians = (rect.rotationDeg * Math.PI) / 180;
  return [
    { x: Math.cos(radians), y: Math.sin(radians) },
    { x: -Math.sin(radians), y: Math.cos(radians) },
  ];
}

function overlapsOnAxis(a: Point[], b: Point[], axis: Point): boolean {
  const project = (points: Point[]) =>
    points.map((point) => point.x * axis.x + point.y * axis.y);
  const pa = project(a);
  const pb = project(b);

  return (
    Math.min(...pa) < Math.max(...pb) - EPSILON_MM &&
    Math.min(...pb) < Math.max(...pa) - EPSILON_MM
  );
}

/**
 * Separating axis test. Opsané obdélníky nestačí: dva bloky otočené o 45° je
 * mají přeložené, i když se samy nedotýkají, a pojistka by odmítla legitimní
 * rozmístění (R10).
 */
export function rectsOverlap(a: PrintRect, b: PrintRect): boolean {
  const cornersA = corners(a);
  const cornersB = corners(b);

  return [...axes(a), ...axes(b)].every((axis) =>
    overlapsOnAxis(cornersA, cornersB, axis),
  );
}

/** Opsaný obdélník otočeného boxu — union bbox kontejneru z něj počítá rozměry. */
export function rectAabbMm(rect: PrintRect): {
  readonly minXMm: number;
  readonly minYMm: number;
  readonly maxXMm: number;
  readonly maxYMm: number;
} {
  const points = corners(rect);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    minXMm: Math.min(...xs),
    minYMm: Math.min(...ys),
    maxXMm: Math.max(...xs),
    maxYMm: Math.max(...ys),
  };
}

export function findPrintCollisions(
  rects: readonly PrintRect[],
): Array<readonly [StageplanBlockSlot, StageplanBlockSlot]> {
  const pairs: Array<readonly [StageplanBlockSlot, StageplanBlockSlot]> = [];

  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      if (a && b && rectsOverlap(a, b)) pairs.push([a.slot, b.slot]);
    }
  }

  return pairs;
}
