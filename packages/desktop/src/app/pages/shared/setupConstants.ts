import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  InputChannel,
  MusicianSetupPreset,
  Preset,
  PresetEntity,
  PresetItem,
  PresetOverridePatch as DomainPresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { STANDARD_10_SETUP } from "../../../../../../src/domain/drums/drumSetup";
import { resolveDrumInputs } from "../../../../../../src/domain/drums/resolveDrumInputs";
import { resolveDefaultMusicianSetup } from "../../../../../../src/domain/setup/resolveDefaultMusicianSetup";
import { buildBassFields, toBassPresets } from "../../components/setup/instruments/bass/buildBassFields";
import { buildGuitarFields } from "../../components/setup/instruments/guitar/buildGuitarFields";
import { buildKeysFields } from "../../components/setup/instruments/keys/buildKeysFields";
import { buildLeadVocsFields } from "../../components/setup/instruments/vocs/buildLeadVocsFields";
import type { BandSetupData, MemberOption, NewProjectPayload } from "../../shell/types";
import type { RoleConstraint } from "../../../projectRules";

export const ROLE_ORDER = ["drums", "bass", "guitar", "keys", "vocs"];

export const GROUP_INPUT_LIBRARY: Record<Group, InputChannel[]> = {
  drums: resolveDrumInputs(STANDARD_10_SETUP),
  bass: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" }],
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
  bass: ["el_bass_xlr_amp", "el_bass_mic", "el_bass_xlr_pedalboard", "bass_synth"],
  guitar: ["el_guitar_mic", "el_guitar_xlr_mono", "el_guitar_xlr_stereo", "ac_guitar"],
  keys: ["keys", "synth", "synth_mono"],
  vocs: ["vocal_lead_wireless", "vocal_lead_wired", "vocal_lead_no_mic"],
} as const;

export function buildSetupFieldCatalog(presetCatalog: Record<string, Preset> = {}) {
  return {
    bassFields: buildBassFields(toBassPresets(PRESET_REFS.bass.map((ref) => presetCatalog[ref]).filter(Boolean))),
    guitarFields: buildGuitarFields(PRESET_REFS.guitar.map((ref) => presetCatalog[ref]).filter(Boolean)),
    keysFields: buildKeysFields(PRESET_REFS.keys.map((ref) => presetCatalog[ref]).filter(Boolean)),
    leadVocsFields: buildLeadVocsFields(PRESET_REFS.vocs.map((ref) => presetCatalog[ref]).filter(Boolean)),
  };
}

export function resolveMusicianDefaultInputsFromPresets(
  group: Group,
  presets: PresetItem[] | undefined,
  presetCatalog: Record<string, Preset> = {},
): InputChannel[] | undefined {
  if (!presets?.length) return undefined;
  const defaultPreset = resolveDefaultMusicianSetup({ role: group, presetItems: presets, getPresetByRef: (ref) => presetCatalog[ref] });
  return defaultPreset.inputs.length > 0 ? defaultPreset.inputs : undefined;
}

function getPresetEntityByRef(
  presetCatalog: Record<string, Preset> | Record<string, PresetEntity> = {},
  ref: string,
): PresetEntity | undefined {
  const entity = (presetCatalog as Record<string, PresetEntity>)[ref];
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
  const mergedDefaults: Partial<MusicianSetupPreset> = {
    ...(args.musicianDefaults ?? {}),
    ...(args.roleScopedDefaults ?? {}),
    ...(args.musicianDefaults?.monitoring || args.roleScopedDefaults?.monitoring
      ? {
          monitoring: {
            ...(args.musicianDefaults?.monitoring ?? {}),
            ...(args.roleScopedDefaults?.monitoring ?? {}),
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

export function resolveSetupCardLabel(args: { role: Group; musicianId?: string; resolveInputs: (musicianId: string) => InputChannel[]; fallback: string }): string {
  if (args.role !== "guitar" || !args.musicianId) return args.fallback;
  const inputs = args.resolveInputs(args.musicianId);
  const hasAcoustic = inputs.some((input) => input.key.startsWith("ac_guitar"));
  const hasElectric = inputs.some((input) => input.key.startsWith("el_guitar"));
  if (hasAcoustic && !hasElectric) return "AC. GUITAR";
  if (hasElectric) return "EL. GUITAR";
  return args.fallback;
}

export function getGroupDefaultPreset(group: Group): MusicianSetupPreset {
  return { inputs: (GROUP_INPUT_LIBRARY[group] ?? []).map((item) => ({ ...item })), monitoring: { monitorRef: "wedge" } };
}

export function buildInputsPatchFromTarget(defaultInputs: InputChannel[], targetInputs: InputChannel[]): NonNullable<DomainPresetOverridePatch["inputs"]> {
  const defaultByKey = new Map(defaultInputs.map((item) => [item.key, item]));
  const targetByKey = new Map(targetInputs.map((item) => [item.key, item]));
  const removeKeys = defaultInputs.filter((item) => !targetByKey.has(item.key)).map((item) => item.key);
  const add = targetInputs.filter((item) => !defaultByKey.has(item.key));
  return { ...(add.length > 0 ? { add } : {}), ...(removeKeys.length > 0 ? { removeKeys } : {}) };
}

export function createFallbackSetupData(project: NewProjectPayload): BandSetupData {
  const constraints = Object.fromEntries(ROLE_ORDER.map((role) => [role, { min: 0, max: 1 }])) as Record<string, RoleConstraint>;
  return {
    id: project.bandRef,
    name: project.displayName || project.bandRef,
    constraints,
    defaultLineup: {},
    members: Object.fromEntries([...ROLE_ORDER, "talkback"].map((role) => [role, []])) as Record<string, MemberOption[]>,
    musicianPresetsById: {},
  };
}
