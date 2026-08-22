import { createDefaultDrumDefinition } from "../../../../../../src/domain/drums/drumDefinition";
import { resolveDrumInputs } from "../../../../../../src/domain/drums/resolveDrumInputs";
import {
  getAcousticGuitarMembers,
  resolveLineupInstrumentMembership,
} from "../../../../../../src/domain/lineup/resolveLineupInstrumentMembership";
import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  PresetOverridePatch as DomainPresetOverridePatch,
  InputChannel,
  MusicianSetupPreset,
  Preset,
  PresetEntity,
  PresetItem,
} from "../../../../../../src/domain/model/types";
import { resolveDefaultMusicianSetup } from "../../../../../../src/domain/setup/resolveDefaultMusicianSetup";
import { resolvePresetIdAlias } from "../../../../../../src/domain/model/presetAliases";
import {
  buildBassFields,
  toBassPresets,
} from "../../components/setup/instruments/bass/buildBassFields";
import { buildGuitarFields } from "../../components/setup/instruments/guitar/buildGuitarFields";
import { buildKeysFields } from "../../components/setup/instruments/keys/buildKeysFields";
import { buildLeadVocsFields } from "../../components/setup/instruments/vocs/buildLeadVocsFields";
import type {
  BandSetupData,
  MemberOption,
  NewProjectPayload,
} from "../../shell/types";

export const ROLE_ORDER = ["drums", "bass", "guitar", "keys", "vocs"];

export type VisibleLineupSection =
  | {
      kind: "role";
      role: string;
    }
  | {
      kind: "acoustic_guitar";
      members: Array<{
        sourceRole: string;
        sourceSlotIndex: number;
        musicianId: string;
      }>;
    };

export const GROUP_INPUT_LIBRARY: Record<Group, InputChannel[]> = {
  drums: resolveDrumInputs(createDefaultDrumDefinition()),
  bass: [
    {
      key: "el_bass_xlr_amp",
      label: "Electric bass guitar",
      note: "XLR out from amp",
      group: "bass",
    },
  ],
  guitar: [
    { key: "gtr_mic", label: "Guitar Mic", group: "guitar" },
    { key: "gtr_di", label: "Guitar DI", group: "guitar" },
  ],
  keys: [
    { key: "keys_l", label: "Keys L", group: "keys" },
    { key: "keys_r", label: "Keys R", group: "keys" },
  ],
  vocs: [
    { key: "voc_lead", label: "Lead Vocal", group: "vocs" },
    { key: "voc_back", label: "Back Vocal", group: "vocs" },
  ],
  talkback: [{ key: "talkback", label: "Talkback", group: "talkback" }],
};

const PRESET_REFS = {
  bass: [
    "el_bass_xlr_amp",
    "el_bass_mic",
    "el_bass_xlr_pedalboard",
    "bass_synth",
  ],
  guitar: [
    "el_guitar_mic",
    "el_guitar_xlr_mono",
    "el_guitar_xlr_stereo",
    "ac_guitar",
  ],
  keys: [
    "keys_stereo_xlr",
    "keys_mono_xlr",
    "keys_stereo_jack",
    "keys_mono_jack",
  ],
  vocs: ["vocal_wireless", "vocal_wired", "vocal_no_mic"],
} as const;

/**
 * Skupinové presety z katalogu kapely (F5d R4). `BandSetupData.presetCatalog`
 * drží `PresetEntity`, tedy i monitory a talkback typy, kdežto
 * `buildSetupFieldCatalog` bere jen `Preset`. Zúžení je čistě typové: všechny
 * čtyři stavitele polí si `type === "preset"` kontrolují znovu i samy
 * (`toBassPresets`, `buildGuitarFields`, `buildKeysFields`,
 * `buildLeadVocsFields`), takže se běhové chování nemění.
 *
 * Žije tady, ne ve stránce: obrazovka `02` ho potřebuje pro modál `Edit inputs`
 * a obrazovka `01` má dnes týž výraz inline (`ProjectSetupPage.tsx` ~ř. 409).
 */
export function pickGroupPresets(
  presetCatalog: Record<string, PresetEntity>,
): Record<string, Preset> {
  return Object.fromEntries(
    Object.entries(presetCatalog).filter(
      (entry): entry is [string, Preset] => entry[1].type === "preset",
    ),
  );
}

export function buildSetupFieldCatalog(
  presetCatalog: Record<string, Preset> = {},
) {
  return {
    bassFields: buildBassFields(
      toBassPresets(
        PRESET_REFS.bass
          .map((ref) => presetCatalog[resolvePresetIdAlias(ref)])
          .filter(Boolean),
      ),
    ),
    guitarFields: buildGuitarFields(
      PRESET_REFS.guitar
        .map((ref) => presetCatalog[resolvePresetIdAlias(ref)])
        .filter(Boolean),
    ),
    keysFields: buildKeysFields(
      PRESET_REFS.keys
        .map((ref) => presetCatalog[resolvePresetIdAlias(ref)])
        .filter(Boolean),
    ),
    leadVocsFields: buildLeadVocsFields(
      PRESET_REFS.vocs
        .map((ref) => presetCatalog[resolvePresetIdAlias(ref)])
        .filter(Boolean),
    ),
  };
}

export function resolveMusicianDefaultInputsFromPresets(
  group: Group,
  presets: PresetItem[] | undefined,
  presetCatalog: Record<string, Preset> = {},
): InputChannel[] | undefined {
  if (!presets?.length) return undefined;
  const defaultPreset = resolveDefaultMusicianSetup({
    role: group,
    presetItems: presets,
    getPresetByRef: (ref) => presetCatalog[resolvePresetIdAlias(ref)],
  });
  return defaultPreset.inputs.length > 0 ? defaultPreset.inputs : undefined;
}

function getPresetEntityByRef(
  presetCatalog: Record<string, Preset> | Record<string, PresetEntity> = {},
  ref: string,
): PresetEntity | undefined {
  const entity = (presetCatalog as Record<string, PresetEntity>)[
    resolvePresetIdAlias(ref)
  ];
  return entity;
}

export function resolveMusicianDefaultSetupForRole(args: {
  role: Group;
  musicianDefaults?: Partial<MusicianSetupPreset>;
  roleScopedDefaults?: Partial<MusicianSetupPreset>;
  presetItems?: PresetItem[];
  presetCatalog?: Record<string, Preset> | Record<string, PresetEntity>;
  bandDefaults?: Partial<MusicianSetupPreset>;
}): MusicianSetupPreset {
  const mergedMonitoring = {
    ...(args.musicianDefaults?.monitoring ?? {}),
    ...(args.roleScopedDefaults?.monitoring ?? {}),
  };

  const mergedDefaults: Partial<MusicianSetupPreset> = {
    ...(args.musicianDefaults ?? {}),
    ...(args.roleScopedDefaults ?? {}),
    ...(mergedMonitoring.monitorRef
      ? {
          monitoring: {
            monitorRef: mergedMonitoring.monitorRef,
            ...(typeof mergedMonitoring.additionalWedgeCount === "number"
              ? {
                  additionalWedgeCount: mergedMonitoring.additionalWedgeCount,
                }
              : {}),
          },
        }
      : {}),
  };

  return resolveDefaultMusicianSetup({
    role: args.role,
    presetItems: args.presetItems,
    musicianDefaults: mergedDefaults,
    bandDefaults: args.bandDefaults,
    getPresetByRef: (ref) => getPresetEntityByRef(args.presetCatalog, ref),
  });
}

export function resolveSetupCardLabel(args: {
  role: Group;
  musicianId?: string;
  resolveInputs: (musicianId: string) => InputChannel[];
  fallback: string;
}): string {
  if (args.role !== "guitar" || !args.musicianId) return args.fallback;
  const membership = resolveLineupInstrumentMembership(
    args.resolveInputs(args.musicianId),
  );
  if (membership.isElectricGuitarMember) return "EL. GUITAR";
  return args.fallback;
}

export function buildVisibleLineupSections(args: {
  roleOrder: string[];
  resolveRoleSlots: (role: string) => Array<{ musicianId?: string }>;
  resolveMusicianDefaultInputs: (musicianId: string) => InputChannel[];
}): VisibleLineupSection[] {
  const roleSections: VisibleLineupSection[] = args.roleOrder.map((role) => ({
    kind: "role",
    role,
  }));

  const acousticMembers = getAcousticGuitarMembers({
    slots: args.roleOrder.flatMap((role) =>
      args.resolveRoleSlots(role).map((slot, slotIndex) => ({
        role,
        slotIndex,
        musicianId: slot.musicianId,
      })),
    ),
    resolveInputs: (musicianId) =>
      args.resolveMusicianDefaultInputs(musicianId),
  }).map((slot) => ({
    sourceRole: slot.role,
    sourceSlotIndex: slot.slotIndex,
    musicianId: slot.musicianId,
  }));

  if (acousticMembers.length === 0) return roleSections;

  const guitarRoleIndex = roleSections.findIndex(
    (section) => section.kind === "role" && section.role === "guitar",
  );

  const acousticSection: VisibleLineupSection = {
    kind: "acoustic_guitar",
    members: acousticMembers,
  };

  if (guitarRoleIndex < 0) {
    return [...roleSections, acousticSection];
  }

  return [
    ...roleSections.slice(0, guitarRoleIndex + 1),
    acousticSection,
    ...roleSections.slice(guitarRoleIndex + 1),
  ];
}

/**
 * Výchozí výbava hudebníka, který nemá jediný preset (F5d R1). Bere `inputs`
 * **prvního** refu role z `PRESET_REFS`, ne union: union by kytaristovi dal
 * mikrofon, DI, stereo pár i akustiku současně a u basy by slil dva presety
 * s `presetRole: "primary"`, které `selectBassMainPreset` schválně rozlišuje.
 * `PRESET_REFS` je táž konstanta, ze které čte `buildSetupFieldCatalog`, takže
 * pořadí refů je jedno rozhodnutí pro fallback i pro katalogy polí.
 *
 * `group` se doplňuje z `preset.group` — kanály v presetech ho nenesou vůbec
 * a bez něj by odvozený kanál spadl do pasti M2 na obou prefixových kopiích.
 *
 * `drums` staví výchozí kit (jediná role, jejíž fallback si klíče nevymýšlel).
 * `talkback` vrací prázdno: jeho preset je `talkback_type` se šablonou
 * `tb_{ownerKey}`, v `PRESET_REFS` ref nemá, řádek staví `buildPdfTalkback`
 * z overlays a v lineupu nemá slot, takže se sem v produkci nedojde.
 *
 * Prázdný katalog dá prázdné `inputs` — táž hodnota, na kterou dnes padá
 * `createDefaultMusicianPreset`, ne nový režim selhání.
 */
export function getGroupDefaultPreset(
  group: Group,
  presetCatalog: Record<string, Preset> | Record<string, PresetEntity> = {},
): MusicianSetupPreset {
  const monitoring = { monitorRef: "wedge_foh" };

  if (group === "drums") {
    return {
      inputs: resolveDrumInputs(createDefaultDrumDefinition()).map((item) => ({
        ...item,
      })),
      monitoring,
    };
  }

  const refs = PRESET_REFS[group as keyof typeof PRESET_REFS];
  const firstRef = refs?.[0];
  if (!firstRef) return { inputs: [], monitoring };

  const preset = getPresetEntityByRef(presetCatalog, firstRef);
  if (preset?.type !== "preset") return { inputs: [], monitoring };

  return {
    inputs: preset.inputs.map((item) => ({ ...item, group: preset.group })),
    monitoring,
  };
}

export function buildInputsPatchFromTarget(
  defaultInputs: InputChannel[],
  targetInputs: InputChannel[],
): NonNullable<DomainPresetOverridePatch["inputs"]> {
  const defaultByKey = new Map(defaultInputs.map((item) => [item.key, item]));
  const targetByKey = new Map(targetInputs.map((item) => [item.key, item]));
  const removeKeys = defaultInputs
    .filter((item) => !targetByKey.has(item.key))
    .map((item) => item.key);
  const add = targetInputs.filter((item) => !defaultByKey.has(item.key));
  return {
    ...(add.length > 0 ? { add } : {}),
    ...(removeKeys.length > 0 ? { removeKeys } : {}),
  };
}

export function createFallbackSetupData(
  project: NewProjectPayload,
): BandSetupData {
  return {
    id: project.bandRef,
    name: project.displayName || project.bandRef,
    defaultLineup: {},
    defaultOverlays: { leadVocals: [], backVocals: [] },
    members: Object.fromEntries(
      [...ROLE_ORDER, "talkback"].map((role) => [role, []]),
    ) as Record<string, MemberOption[]>,
    musicianPresetsById: {},
  };
}
