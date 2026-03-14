import type { InputChannel } from "../model/types";

export type MusicianInstrumentCapabilities = {
  hasElectricGuitarCapability: boolean;
  hasAcousticGuitarCapability: boolean;
};

export type LineupInstrumentMembership = MusicianInstrumentCapabilities & {
  isElectricGuitarMember: boolean;
  isAcousticOnlyGuitarMember: boolean;
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function hasElectricGuitarCapability(inputs: InputChannel[]): boolean {
  return inputs.some((input) => normalizeKey(input.key).startsWith("el_guitar"));
}

export function hasAcousticGuitarCapability(inputs: InputChannel[]): boolean {
  return inputs.some((input) => normalizeKey(input.key).startsWith("ac_guitar"));
}

export function resolveMusicianInstrumentCapabilities(
  inputs: InputChannel[],
): MusicianInstrumentCapabilities {
  return {
    hasElectricGuitarCapability: hasElectricGuitarCapability(inputs),
    hasAcousticGuitarCapability: hasAcousticGuitarCapability(inputs),
  };
}

export function resolveLineupInstrumentMembership(
  inputs: InputChannel[],
): LineupInstrumentMembership {
  const capabilities = resolveMusicianInstrumentCapabilities(inputs);
  const isElectricGuitarMember = capabilities.hasElectricGuitarCapability;
  const isAcousticOnlyGuitarMember =
    capabilities.hasAcousticGuitarCapability && !capabilities.hasElectricGuitarCapability;

  return {
    ...capabilities,
    isElectricGuitarMember,
    isAcousticOnlyGuitarMember,
  };
}
