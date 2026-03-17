export type DrumKick = { in: boolean; out: boolean };
export type DrumSnare = { top: boolean; bottom: boolean };

export type DrumPad =
  | { enabled: false }
  | {
      enabled: true;
      mode: "sfx" | "backing";
      channels: "mono" | "stereo";
    };

export type DrumTracks = { enabled: boolean };

export type DrumDefinition = {
  kickCount: 1 | 2;
  kicks: [DrumKick, DrumKick?];
  snareCount: 1 | 2 | 3;
  snares: [DrumSnare, DrumSnare?, DrumSnare?];
  hasHiHat: boolean;
  tomCount: 0 | 1 | 2 | 3 | 4;
  floorCount: 0 | 1 | 2 | 3;
  hasOverheads: boolean;
  pad: DrumPad;
  tracks: DrumTracks;
};

function clampToAllowed<T extends number>(value: number, allowed: readonly T[]): T {
  let next = allowed[0];
  let minDistance = Math.abs(value - next);
  for (const option of allowed) {
    const distance = Math.abs(value - option);
    if (distance < minDistance) {
      next = option;
      minDistance = distance;
    }
  }
  return next;
}

const KICK_COUNTS = [1, 2] as const;
const SNARE_COUNTS = [1, 2, 3] as const;
const TOM_COUNTS = [0, 1, 2, 3, 4] as const;
const FLOOR_COUNTS = [0, 1, 2, 3] as const;

export function toKickCount(value: number): DrumDefinition["kickCount"] {
  return clampToAllowed(value, KICK_COUNTS);
}

export function toSnareCount(value: number): DrumDefinition["snareCount"] {
  return clampToAllowed(value, SNARE_COUNTS);
}

export function toTomCount(value: number): DrumDefinition["tomCount"] {
  return clampToAllowed(value, TOM_COUNTS);
}

export function toFloorCount(value: number): DrumDefinition["floorCount"] {
  return clampToAllowed(value, FLOOR_COUNTS);
}

export function createDefaultDrumDefinition(): DrumDefinition {
  return {
    kickCount: 1,
    kicks: [{ in: true, out: true }],
    snareCount: 1,
    snares: [{ top: true, bottom: true }],
    hasHiHat: true,
    tomCount: 2,
    floorCount: 1,
    hasOverheads: true,
    pad: { enabled: false },
    tracks: { enabled: false },
  };
}

export function normalizeDrumDefinition(definition: DrumDefinition): DrumDefinition {
  return {
    ...definition,
    kicks: [definition.kicks[0], definition.kickCount === 2 ? definition.kicks[1] : undefined],
    snares: [
      definition.snares[0],
      definition.snareCount >= 2 ? definition.snares[1] : undefined,
      definition.snareCount >= 3 ? definition.snares[2] : undefined,
    ],
  };
}

function readBoolean(value: unknown, context: string, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${context}: ${field} must be boolean.`);
  return value;
}

function readCount<T extends number>(value: unknown, allowed: readonly T[], context: string, field: string): T {
  if (typeof value !== "number" || !(allowed as readonly number[]).includes(value)) {
    throw new Error(`Invalid ${context}: ${field} must be one of [${allowed.join(", ")}].`);
  }
  return value as T;
}

function readKick(value: unknown, context: string, field: string): DrumKick {
  if (!value || typeof value !== "object") throw new Error(`Invalid ${context}: ${field} must be object.`);
  const raw = value as Record<string, unknown>;
  return {
    in: readBoolean(raw.in, context, `${field}.in`),
    out: readBoolean(raw.out, context, `${field}.out`),
  };
}

function readSnare(value: unknown, context: string, field: string): DrumSnare {
  if (!value || typeof value !== "object") throw new Error(`Invalid ${context}: ${field} must be object.`);
  const raw = value as Record<string, unknown>;
  return {
    top: readBoolean(raw.top, context, `${field}.top`),
    bottom: readBoolean(raw.bottom, context, `${field}.bottom`),
  };
}

function parsePad(value: unknown, context: string): DrumPad {
  if (!value || typeof value !== "object") throw new Error(`Invalid ${context}: pad must be object.`);
  const raw = value as Record<string, unknown>;
  const enabled = readBoolean(raw.enabled, context, "pad.enabled");
  if (!enabled) return { enabled: false };

  if (raw.mode !== "sfx" && raw.mode !== "backing") {
    throw new Error(`Invalid ${context}: pad.mode must be 'sfx' or 'backing'.`);
  }
  if (raw.channels !== "mono" && raw.channels !== "stereo") {
    throw new Error(`Invalid ${context}: pad.channels must be 'mono' or 'stereo'.`);
  }

  return { enabled: true, mode: raw.mode, channels: raw.channels };
}

export function parseDrumDefinition(input: unknown, context = "drum definition"): DrumDefinition {
  if (!input || typeof input !== "object") {
    throw new Error(`Invalid ${context}: expected object.`);
  }

  const raw = input as Record<string, unknown>;
  if ("floorTomCount" in raw || "extraSnareCount" in raw) {
    throw new Error(`Invalid ${context}: unsupported legacy drum setup shape.`);
  }

  const kickCount = readCount(raw.kickCount, [1, 2] as const, context, "kickCount");
  const snareCount = readCount(raw.snareCount, [1, 2, 3] as const, context, "snareCount");
  const tomCount = readCount(raw.tomCount, [0, 1, 2, 3, 4] as const, context, "tomCount");
  const floorCount = readCount(raw.floorCount, [0, 1, 2, 3] as const, context, "floorCount");

  if (!Array.isArray(raw.kicks)) throw new Error(`Invalid ${context}: kicks must be an array.`);
  if (!Array.isArray(raw.snares)) throw new Error(`Invalid ${context}: snares must be an array.`);
  if (raw.kicks.length < kickCount) throw new Error(`Invalid ${context}: kicks length must be >= kickCount.`);
  if (raw.snares.length < snareCount) throw new Error(`Invalid ${context}: snares length must be >= snareCount.`);
  if (!raw.tracks || typeof raw.tracks !== "object") throw new Error(`Invalid ${context}: tracks must be object.`);

  const tracksRaw = raw.tracks as Record<string, unknown>;
  return normalizeDrumDefinition({
    kickCount,
    kicks: [readKick(raw.kicks[0], context, "kicks[0]"), kickCount === 2 ? readKick(raw.kicks[1], context, "kicks[1]") : undefined],
    snareCount,
    snares: [
      readSnare(raw.snares[0], context, "snares[0]"),
      snareCount >= 2 ? readSnare(raw.snares[1], context, "snares[1]") : undefined,
      snareCount >= 3 ? readSnare(raw.snares[2], context, "snares[2]") : undefined,
    ],
    hasHiHat: readBoolean(raw.hasHiHat, context, "hasHiHat"),
    tomCount,
    floorCount,
    hasOverheads: readBoolean(raw.hasOverheads, context, "hasOverheads"),
    pad: parsePad(raw.pad, context),
    tracks: { enabled: readBoolean(tracksRaw.enabled, context, "tracks.enabled") },
  });
}

export function parsePersistedDrumDefinition(input: unknown, context = "drum definition"): DrumDefinition {
  return parseDrumDefinition(input, context);
}
