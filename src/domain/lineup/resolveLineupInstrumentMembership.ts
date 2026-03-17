import type { InputChannel, PresetEntity, PresetItem } from "../model/types";
import { resolveDrumInputs } from "../drums/resolveDrumInputs";
import { createDefaultDrumDefinition, parsePersistedDrumDefinition } from "../drums/drumDefinition";

export type SetupCapabilitySection =
  | "drums"
  | "bass"
  | "guitar"
  | "keys"
  | "vocs"
  | "acoustic_guitar";

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

function isGroupInputKey(
  key: string,
  group: Exclude<SetupCapabilitySection, "acoustic_guitar">,
): boolean {
  const normalized = normalizeKey(key);
  if (group === "guitar") return normalized.startsWith("el_guitar");
  if (group === "bass") return normalized.startsWith("el_bass") || normalized.startsWith("bass_");
  if (group === "vocs") return normalized.startsWith("voc_") || normalized.startsWith("vocal_");
  if (group === "drums") return normalized.startsWith("dr_");
  return normalized.startsWith(`${group}_`);
}

export function supportsCapabilitySection(args: {
  section: SetupCapabilitySection;
  inputs: InputChannel[];
}): boolean {
  const { section, inputs } = args;
  if (section === "acoustic_guitar") {
    return hasAcousticGuitarCapability(inputs);
  }
  return inputs.some((input) => isGroupInputKey(input.key, section));
}

export function detectPresetInstrumentCapabilities(
  inputs: InputChannel[],
): MusicianInstrumentCapabilities {
  return inputs.reduce<MusicianInstrumentCapabilities>(
    (capabilities, input) => {
      const key = normalizeKey(input.key);
      if (key.startsWith("el_guitar"))
        capabilities.hasElectricGuitarCapability = true;
      if (key.startsWith("ac_guitar"))
        capabilities.hasAcousticGuitarCapability = true;
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

export function hasAcousticGuitarPreset(inputs: InputChannel[]): boolean {
  return hasAcousticGuitarCapability(inputs);
}

export function resolveMusicianInstrumentCapabilities(
  inputs: InputChannel[],
): MusicianInstrumentCapabilities {
  return detectPresetInstrumentCapabilities(inputs);
}

export function isAcousticOnlyMember(
  capabilities: MusicianInstrumentCapabilities,
): boolean {
  return (
    capabilities.hasAcousticGuitarCapability &&
    !capabilities.hasElectricGuitarCapability
  );
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

export function getAcousticGuitarMembers<
  T extends { musicianId?: string },
>(args: {
  slots: Array<T & { role: string; slotIndex: number }>;
  resolveInputs: (musicianId: string) => InputChannel[];
}): Array<T & { role: string; slotIndex: number; musicianId: string }> {
  return args.slots
    .filter(
      (
        slot,
      ): slot is T & { role: string; slotIndex: number; musicianId: string } =>
        Boolean(slot.musicianId),
    )
    .filter((slot) =>
      isAcousticOnlyMember(
        resolveMusicianInstrumentCapabilities(
          args.resolveInputs(slot.musicianId),
        ),
      ),
    );
}

export function resolveMusicianCapabilityInputs(args: {
  presetItems?: PresetItem[];
  getPresetByRef: (ref: string) => PresetEntity | undefined;
}): InputChannel[] {
  const byKey = new Map<string, InputChannel>();
  (args.presetItems ?? []).forEach((item) => {
    if (item.kind === "preset") {
      const entity = args.getPresetByRef(item.ref);
      if (entity?.type !== "preset") return;
      entity.inputs.forEach((input) => {
        if (!byKey.has(input.key)) byKey.set(input.key, { ...input });
      });
      return;
    }

    if (item.kind === "drum_setup") {
      const parsedSetup = item.setup
        ? parsePersistedDrumDefinition(item.setup, "lineup drummer preset")
        : createDefaultDrumDefinition();
      const inputs = resolveDrumInputs(parsedSetup);
      inputs.forEach((input) => {
        if (!byKey.has(input.key)) byKey.set(input.key, { ...input });
      });
    }
  });

  return Array.from(byKey.values());
}

export function resolveInputsForCapabilitySection(args: {
  section: SetupCapabilitySection;
  inputs: InputChannel[];
}): InputChannel[] {
  const { section, inputs } = args;
  if (section === "acoustic_guitar") {
    return inputs.filter((input) =>
      normalizeKey(input.key).startsWith("ac_guitar"),
    );
  }
  return inputs.filter((input) => isGroupInputKey(input.key, section));
}
