import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  InputChannel,
  MusicianSetupPreset,
  Preset,
  PresetItem,
  PresetOverridePatch as DomainPresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { STANDARD_10_SETUP } from "../../../../../../src/domain/drums/drumSetup";
import { resolveDrumInputs } from "../../../../../../src/domain/drums/resolveDrumInputs";
import {
  buildBassFields,
  toBassPresets,
} from "../../components/setup/instruments/bass/buildBassFields";
import type { BandSetupData, MemberOption, NewProjectPayload } from "../../shell/types";
import type { RoleConstraint } from "../../../projectRules";
import elBassXlrAmpPreset from "../../../../../../data/assets/presets/groups/bass/el_bass_xlr_amp.json";
import elBassMicPreset from "../../../../../../data/assets/presets/groups/bass/el_bass_mic.json";
import elBassXlrPedalboardPreset from "../../../../../../data/assets/presets/groups/bass/el_bass_xlr_pedalboard.json";
import bassSynthPreset from "../../../../../../data/assets/presets/groups/bass/bass_synth.json";

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

export const BASS_FIELDS = buildBassFields(
  toBassPresets([
    elBassXlrAmpPreset,
    elBassMicPreset,
    elBassXlrPedalboardPreset,
    bassSynthPreset,
  ] as Preset[]),
);


const BASS_PRESET_INPUTS_BY_REF: Record<string, InputChannel> = {
  el_bass_xlr_amp: { key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" },
  el_bass_xlr_pedalboard: { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", note: "XLR out from pedalboard", group: "bass" },
};

export function resolveMusicianDefaultInputsFromPresets(group: Group, presets: PresetItem[] | undefined): InputChannel[] | undefined {
  if (group !== "bass") return undefined;
  const primaryPresetRef = presets?.find((item) => item.kind === "preset")?.ref;
  if (!primaryPresetRef) return undefined;
  const mapped = BASS_PRESET_INPUTS_BY_REF[primaryPresetRef];
  return mapped ? [{ ...mapped }] : undefined;
}

export function getGroupDefaultPreset(group: Group): MusicianSetupPreset {
  return {
    inputs: (GROUP_INPUT_LIBRARY[group] ?? []).map((item) => ({ ...item })),
    monitoring: {
      type: "wedge",
      mode: "mono",
      mixCount: 1,
    },
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

export function createFallbackSetupData(project: NewProjectPayload): BandSetupData {
  const constraints = Object.fromEntries(
    ROLE_ORDER.map((role) => [role, { min: 0, max: 1 }]),
  ) as Record<string, RoleConstraint>;
  return {
    id: project.bandRef,
    name: project.displayName || project.bandRef,
    constraints,
    defaultLineup: {},
    members: Object.fromEntries(
      [...ROLE_ORDER, "talkback"].map((role) => [role, []]),
    ) as Record<string, MemberOption[]>,
    musicianPresetsById: {},
  };
}
