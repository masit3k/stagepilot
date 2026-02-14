import type { InputChannel } from "../model/types.js";

export type PadMode = "sfx" | "backing";
export type PadChannels = "mono" | "stereo";

export type DrumSetup = {
  tomCount: number;
  floorTomCount: number;
  hasHiHat: boolean;
  hasOverheads: boolean;
  extraSnareCount: number;
  pad:
    | { enabled: false }
    | {
        enabled: true;
        mode: PadMode;
        channels: PadChannels;
      };
};

export type DrumPartsControlsPatch = {
  tomCount?: number;
  floorTomCount?: number;
  hasHiHat?: boolean;
  hasOverheads?: boolean;
  extraSnareCount?: number;
  padEnabled?: boolean;
  padMode?: PadMode;
  padChannels?: PadChannels;
};

export const STANDARD_9_SETUP: DrumSetup = {
  tomCount: 1,
  floorTomCount: 1,
  hasHiHat: true,
  hasOverheads: true,
  extraSnareCount: 0,
  pad: { enabled: false },
};

export const STANDARD_10_SETUP: DrumSetup = {
  tomCount: 2,
  floorTomCount: 1,
  hasHiHat: true,
  hasOverheads: true,
  extraSnareCount: 0,
  pad: { enabled: false },
};

function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function clampTomCount(value: number): number {
  return Math.max(0, Math.min(4, Math.trunc(value)));
}

export function clampFloorCount(value: number): number {
  return Math.max(0, Math.min(4, Math.trunc(value)));
}

export function clampExtraSnareCount(value: number): number {
  return Math.max(0, Math.min(2, Math.trunc(value)));
}

export function applyDrumPartsControlsToSetup(setup: DrumSetup, patch: DrumPartsControlsPatch): DrumSetup {
  const nextPadEnabled = patch.padEnabled ?? setup.pad.enabled;
  const nextMode = patch.padMode ?? (setup.pad.enabled ? setup.pad.mode : "sfx");
  const nextChannels = patch.padChannels ?? (setup.pad.enabled ? setup.pad.channels : "mono");

  return {
    tomCount: clampTomCount(patch.tomCount ?? setup.tomCount),
    floorTomCount: clampFloorCount(patch.floorTomCount ?? setup.floorTomCount),
    hasHiHat: patch.hasHiHat ?? setup.hasHiHat,
    hasOverheads: patch.hasOverheads ?? setup.hasOverheads,
    extraSnareCount: clampExtraSnareCount(patch.extraSnareCount ?? setup.extraSnareCount),
    pad: nextPadEnabled
      ? {
          enabled: true,
          mode: nextMode,
          channels: nextChannels,
        }
      : { enabled: false },
  };
}

export function validateDrumSetup(setup: DrumSetup): string[] {
  const errors: string[] = [];
  if (!isIntegerInRange(setup.tomCount, 0, 4)) errors.push("tomCount must be an integer between 0 and 4.");
  if (!isIntegerInRange(setup.floorTomCount, 0, 4)) {
    errors.push("floorTomCount must be an integer between 0 and 4.");
  }
  if (!isIntegerInRange(setup.extraSnareCount, 0, 2)) {
    errors.push("extraSnareCount must be an integer between 0 and 2.");
  }
  if (setup.pad.enabled && (!setup.pad.mode || !setup.pad.channels)) {
    errors.push("pad.mode and pad.channels are required when pad is enabled.");
  }
  return errors;
}

export type LegacyDrumPresetRef = "standard_9" | "standard_10" | "sample_pad_mono" | "sample_pad_stereo" | "snare_2" | "effect_snare";

function isLegacyDrumRef(value: string): value is LegacyDrumPresetRef {
  return ["standard_9", "standard_10", "sample_pad_mono", "sample_pad_stereo", "snare_2", "effect_snare"].includes(value);
}

export function inferDrumSetupFromLegacyInputs(inputs: InputChannel[]): DrumSetup {
  const keys = new Set(inputs.map((input) => input.key));
  const tomCount = ["dr_tom_1", "dr_tom_2", "dr_tom_3", "dr_tom_4"].filter((k) => keys.has(k)).length;
  const floorTomCount = ["dr_floor_1", "dr_floor_2", "dr_floor_3", "dr_floor_4", "dr_floor_tom"].filter((k) => keys.has(k)).length;
  const extraSnareCount = ["dr_snare2_top", "dr_snare3_top", "dr_snare_2_top"].filter((k) => keys.has(k)).length;
  const hasOverheads = keys.has("dr_oh_l") && keys.has("dr_oh_r");
  const hasHiHat = keys.has("dr_hihat");
  const isStereoPad = keys.has("dr_pad_l") && keys.has("dr_pad_r");
  const isMonoPad = keys.has("dr_pad");

  return {
    tomCount,
    floorTomCount,
    hasHiHat,
    hasOverheads,
    extraSnareCount: Math.min(extraSnareCount, 2),
    pad: isStereoPad
      ? { enabled: true, mode: "sfx", channels: "stereo" }
      : isMonoPad
      ? { enabled: true, mode: "sfx", channels: "mono" }
      : { enabled: false },
  };
}

export function migrateLegacyDrumPresetRefs(refs: string[]): DrumSetup {
  let setup: DrumSetup = { ...STANDARD_9_SETUP };
  let matchedAny = false;

  for (const ref of refs) {
    if (!isLegacyDrumRef(ref)) continue;
    matchedAny = true;
    if (ref === "standard_10") setup = { ...STANDARD_10_SETUP };
    if (ref === "standard_9") setup = { ...STANDARD_9_SETUP };
    if (ref === "sample_pad_mono") setup = { ...setup, pad: { enabled: true, mode: "sfx", channels: "mono" } };
    if (ref === "sample_pad_stereo") setup = { ...setup, pad: { enabled: true, mode: "sfx", channels: "stereo" } };
    if (ref === "snare_2" || ref === "effect_snare") {
      setup = { ...setup, extraSnareCount: Math.max(setup.extraSnareCount, 1) };
    }
  }

  if (!matchedAny) {
    console.warn("Unknown legacy drum configuration detected, falling back to standard_9 setup.");
  }

  return setup;
}
