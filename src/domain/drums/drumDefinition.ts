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
  const kicks: [DrumKick, DrumKick?] = [definition.kicks[0] ?? { in: true, out: true }];
  if (definition.kickCount === 2) kicks[1] = definition.kicks[1] ?? { in: true, out: false };

  const snares: [DrumSnare, DrumSnare?, DrumSnare?] = [definition.snares[0] ?? { top: true, bottom: true }];
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
