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

export function detectPresetInstrumentCapabilities(
  inputs: InputChannel[],
): MusicianInstrumentCapabilities {
  return inputs.reduce<MusicianInstrumentCapabilities>(
    (capabilities, input) => {
      const key = normalizeKey(input.key);
      if (key.startsWith("el_guitar")) capabilities.hasElectricGuitarCapability = true;
      if (key.startsWith("ac_guitar")) capabilities.hasAcousticGuitarCapability = true;
      return capabilities;
    },
    {
      hasElectricGuitarCapability: false,
      hasAcousticGuitarCapability: false,
    },
  );
}

export function hasElectricGuitarCapability(inputs: InputChannel[]): boolean {
  return detectPresetInstrumentCapabilities(inputs).hasElectricGuitarCapability;
}

export function hasAcousticGuitarCapability(inputs: InputChannel[]): boolean {
  return detectPresetInstrumentCapabilities(inputs).hasAcousticGuitarCapability;
}

export function resolveMusicianInstrumentCapabilities(
  inputs: InputChannel[],
): MusicianInstrumentCapabilities {
  return detectPresetInstrumentCapabilities(inputs);
}

export function isAcousticOnlyMember(
  capabilities: MusicianInstrumentCapabilities,
): boolean {
  return capabilities.hasAcousticGuitarCapability && !capabilities.hasElectricGuitarCapability;
}

export function resolveLineupInstrumentMembership(
  inputs: InputChannel[],
): LineupInstrumentMembership {
  const capabilities = resolveMusicianInstrumentCapabilities(inputs);
  const isElectricGuitarMember = capabilities.hasElectricGuitarCapability;
  const isAcousticOnlyGuitarMember = isAcousticOnlyMember(capabilities);

  return {
    ...capabilities,
    isElectricGuitarMember,
    isAcousticOnlyGuitarMember,
  };
}
