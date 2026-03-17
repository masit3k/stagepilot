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

type LegacyDrumPad = {
  enabled?: unknown;
  mode?: unknown;
  channels?: unknown;
};

type LegacyDrumDefinition = {
  tomCount?: unknown;
  floorTomCount?: unknown;
  hasHiHat?: unknown;
  hasOverheads?: unknown;
  extraSnareCount?: unknown;
  pad?: LegacyDrumPad;
};

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
  const kicks: [DrumKick, DrumKick?] = [definition.kicks?.[0] ?? { in: true, out: true }];
  if (definition.kickCount === 2) kicks[1] = definition.kicks[1] ?? { in: true, out: false };

  const snares: [DrumSnare, DrumSnare?, DrumSnare?] = [definition.snares?.[0] ?? { top: true, bottom: true }];
  if (definition.snareCount >= 2) snares[1] = definition.snares[1] ?? { top: true, bottom: false };
  if (definition.snareCount >= 3) snares[2] = definition.snares[2] ?? { top: true, bottom: false };

  const pad = !definition.pad.enabled
    ? { enabled: false as const }
    : definition.pad.mode === "backing"
    ? { enabled: true as const, mode: "backing" as const, channels: "stereo" as const }
    : { enabled: true as const, mode: "sfx" as const, channels: definition.pad.channels };

  return {
    ...definition,
    kicks,
    snares,
    pad,
  };
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asCount<T extends number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "number" && (allowed as readonly number[]).includes(value) ? (value as T) : fallback;
}

function isLegacyDrumDefinition(input: unknown): input is LegacyDrumDefinition {
  if (!input || typeof input !== "object") return false;
  return "floorTomCount" in input || "extraSnareCount" in input;
}

function toLegacyDrumDefinition(input: LegacyDrumDefinition): DrumDefinition {
  const fallback = createDefaultDrumDefinition();
  const snareCount = Math.max(1, Math.min(3, 1 + (typeof input.extraSnareCount === "number" ? input.extraSnareCount : 0))) as 1 | 2 | 3;
  const padEnabled = input.pad?.enabled === true;

  return normalizeDrumDefinition({
    kickCount: 1,
    kicks: [{ in: true, out: true }],
    snareCount,
    snares: [
      { top: true, bottom: true },
      ...(snareCount >= 2 ? [{ top: true, bottom: false } as DrumSnare] : []),
      ...(snareCount >= 3 ? [{ top: true, bottom: false } as DrumSnare] : []),
    ] as [DrumSnare, DrumSnare?, DrumSnare?],
    hasHiHat: asBoolean(input.hasHiHat, fallback.hasHiHat),
    tomCount: asCount(input.tomCount, [0, 1, 2, 3, 4] as const, fallback.tomCount),
    floorCount: asCount(input.floorTomCount, [0, 1, 2, 3] as const, fallback.floorCount),
    hasOverheads: asBoolean(input.hasOverheads, fallback.hasOverheads),
    pad: !padEnabled
      ? ({ enabled: false } as const)
      : ({
          enabled: true as const,
          mode: input.pad?.mode === "backing" ? ("backing" as const) : ("sfx" as const),
          channels: input.pad?.channels === "stereo" ? ("stereo" as const) : ("mono" as const),
        } as const),
    tracks: { enabled: false },
  });
}

export function parseDrumDefinition(input: unknown, fallback = createDefaultDrumDefinition()): DrumDefinition {
  if (isLegacyDrumDefinition(input)) return toLegacyDrumDefinition(input);
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Partial<DrumDefinition>;

  const kickCount = asCount(raw.kickCount, [1, 2] as const, fallback.kickCount);
  const snareCount = asCount(raw.snareCount, [1, 2, 3] as const, fallback.snareCount);
  const tomCount = asCount(raw.tomCount, [0, 1, 2, 3, 4] as const, fallback.tomCount);
  const floorCount = asCount(raw.floorCount, [0, 1, 2, 3] as const, fallback.floorCount);

  const kicks = [
    {
      in: asBoolean(raw.kicks?.[0]?.in, fallback.kicks[0].in),
      out: asBoolean(raw.kicks?.[0]?.out, fallback.kicks[0].out),
    },
    kickCount === 2
      ? {
          in: asBoolean(raw.kicks?.[1]?.in, fallback.kicks[1]?.in ?? true),
          out: asBoolean(raw.kicks?.[1]?.out, fallback.kicks[1]?.out ?? false),
        }
      : undefined,
  ] as [DrumKick, DrumKick?];

  const snares = [
    {
      top: asBoolean(raw.snares?.[0]?.top, fallback.snares[0].top),
      bottom: asBoolean(raw.snares?.[0]?.bottom, fallback.snares[0].bottom),
    },
    snareCount >= 2
      ? {
          top: asBoolean(raw.snares?.[1]?.top, fallback.snares[1]?.top ?? true),
          bottom: asBoolean(raw.snares?.[1]?.bottom, fallback.snares[1]?.bottom ?? false),
        }
      : undefined,
    snareCount >= 3
      ? {
          top: asBoolean(raw.snares?.[2]?.top, fallback.snares[2]?.top ?? true),
          bottom: asBoolean(raw.snares?.[2]?.bottom, fallback.snares[2]?.bottom ?? false),
        }
      : undefined,
  ] as [DrumSnare, DrumSnare?, DrumSnare?];

  const pad: DrumPad = !raw.pad || typeof raw.pad !== "object" || raw.pad.enabled !== true
    ? ({ enabled: false } as const)
    : ({
        enabled: true as const,
        mode: raw.pad.mode === "backing" ? ("backing" as const) : ("sfx" as const),
        channels: raw.pad.channels === "stereo" ? ("stereo" as const) : ("mono" as const),
      } as const);

  const tracks = {
    enabled: asBoolean(raw.tracks?.enabled, fallback.tracks.enabled),
  };

  return normalizeDrumDefinition({
    kickCount,
    kicks,
    snareCount,
    snares,
    hasHiHat: asBoolean(raw.hasHiHat, fallback.hasHiHat),
    tomCount,
    floorCount,
    hasOverheads: asBoolean(raw.hasOverheads, fallback.hasOverheads),
    pad,
    tracks,
  });
}

export function parsePersistedDrumDefinition(input: unknown, context = "drum definition"): DrumDefinition {
  if (!input || typeof input !== "object") {
    throw new Error(`Invalid ${context}: expected object.`);
  }

  const raw = input as Record<string, unknown>;
  const hasCanonicalMarkers = ["kickCount", "kicks", "snareCount", "snares", "floorCount", "tracks"].some((key) => key in raw);
  const hasLegacyMarkers = isLegacyDrumDefinition(raw);
  if (!hasCanonicalMarkers && !hasLegacyMarkers) {
    throw new Error(`Invalid ${context}: unsupported shape.`);
  }

  return parseDrumDefinition(raw);
}
