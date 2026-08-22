import type { InputChannel, PresetEntity, PresetItem } from "../model/types";
import { resolveDrumInputs } from "../drums/resolveDrumInputs";
import { parsePersistedDrumDefinition } from "../drums/drumDefinition";

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

/**
 * Kopie 1 ze dvou prefixových rozpoznávání (F5d R1). Odpovídá na „patří
 * tenhle kanál do téhle sekce"; kopie 2 (`effectiveInstrumentGroups.ts`) na
 * „do kterého řezu kanál spadá". Obě nesou stejné pravidlo, ale neslučují se
 * — kopie 2 zná `lead_voc`/`back_voc`, kopie 1 ne.
 *
 * Bere celý `InputChannel`, ne jen klíč: kanál z `getGroupDefaultPreset` a z
 * ručního `inputs.add` nese `group`, a bez fallbacku na něj by klíč mimo
 * prefix vypadl ze sekce úplně (M2 — `gtr_mic` odebral kytaristovi kytaru).
 * Kanál odvozený z presetu naopak `group` **nenese** (žádný z 16 souborů v
 * `data/assets/presets/groups/` ho na prvcích `inputs[]` nemá), takže holý
 * klíč `keys` z `keys_mono_*` musí projít prefixovou větví — proto je
 * vyjmenovaný.
 *
 * `acoustic_guitar` se sem nedostane: typ ho vylučuje a oba volající ho řeší
 * prefixem `ac_guitar` mimo tuhle funkci. Asymetrie „elektrika dostane
 * fallback, akustika ne" (kopie 2) je tím vynucená strukturou.
 */
function isGroupInputKey(
  input: InputChannel,
  group: Exclude<SetupCapabilitySection, "acoustic_guitar">,
): boolean {
  const normalized = normalizeKey(input.key);
  const inputGroup = normalizeKey(input.group ?? "");
  if (group === "guitar")
    return normalized.startsWith("el_guitar") || inputGroup === "guitar";
  if (group === "bass")
    return (
      normalized.startsWith("el_bass") ||
      normalized.startsWith("bass_") ||
      inputGroup === "bass"
    );
  if (group === "vocs")
    return (
      normalized.startsWith("voc_") ||
      normalized.startsWith("vocal_") ||
      inputGroup === "vocs"
    );
  if (group === "drums")
    return normalized.startsWith("dr_") || inputGroup === "drums";
  if (group === "keys")
    return (
      normalized === "keys" ||
      normalized.startsWith("keys_") ||
      inputGroup === "keys"
    );
  return normalized.startsWith(`${group}_`) || inputGroup === group;
}

export function supportsCapabilitySection(args: {
  section: SetupCapabilitySection;
  inputs: InputChannel[];
}): boolean {
  const { section, inputs } = args;
  if (section === "acoustic_guitar") {
    return hasAcousticGuitarCapability(inputs);
  }
  return inputs.some((input) => isGroupInputKey(input, section));
}

/**
 * Fallback `group === "guitar"` dostává **jen** `hasElectricGuitarCapability`
 * (F5d R1). Kdyby ho dostala i akustika, kanál `ac_guitar` — kterému
 * `group: "guitar"` doplní `getGroupDefaultPreset` — by kytaristu prohlásil
 * za elektrického i akustického zároveň, `isAcousticOnlyMember` by přestal
 * fungovat a sekce `acoustic_guitar` na `01` by zmizela.
 */
export function detectPresetInstrumentCapabilities(
  inputs: InputChannel[],
): MusicianInstrumentCapabilities {
  return inputs.reduce<MusicianInstrumentCapabilities>(
    (capabilities, input) => {
      const key = normalizeKey(input.key);
      const group = normalizeKey(input.group ?? "");
      if (key.startsWith("ac_guitar")) {
        capabilities.hasAcousticGuitarCapability = true;
        return capabilities;
      }
      if (key.startsWith("el_guitar") || group === "guitar")
        capabilities.hasElectricGuitarCapability = true;
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
      const parsedSetup = parsePersistedDrumDefinition(item.setup, "lineup drummer preset");
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
  return inputs.filter((input) => isGroupInputKey(input, section));
}
