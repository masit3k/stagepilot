import type { Preset } from "../../../../../../../../src/domain/model/types";
import { withInputsTarget, type EventSetupEditState } from "../../adapters/eventSetupAdapter";
import type { DropdownFieldDef, SchemaNode } from "../../schema/types";

type LeadPreset = Preset & { id: "vocal_lead_wireless" | "vocal_lead_wired" | "vocal_lead_no_mic" };

const ORDER: Array<{ id: LeadPreset["id"]; label: string }> = [
  { id: "vocal_lead_wireless", label: "Own wireless mic" },
  { id: "vocal_lead_wired", label: "Own wired mic" },
  { id: "vocal_lead_no_mic", label: "No own mic" },
];

function readCurrent(state: EventSetupEditState, presets: Record<string, LeadPreset | undefined>): string {
  for (const entry of ORDER) {
    const preset = presets[entry.id];
    if (!preset) continue;
    if (preset.inputs.some((item) => state.effectivePreset.inputs.some((input) => input.key === item.key))) return entry.id;
  }
  return ORDER[0].id;
}

function readDefault(state: EventSetupEditState, presets: Record<string, LeadPreset | undefined>): string {
  for (const entry of ORDER) {
    const preset = presets[entry.id];
    if (!preset) continue;
    if (preset.inputs.some((item) => state.defaultPreset.inputs.some((input) => input.key === item.key))) return entry.id;
  }
  return ORDER[0].id;
}

export function buildLeadVocsFields(presets: Preset[]): SchemaNode[] {
  const byId = Object.fromEntries(
    presets
      .filter((preset): preset is LeadPreset => preset.type === "preset" && preset.group === "vocs" && ORDER.some((item) => item.id === preset.id))
      .map((preset) => [preset.id, preset]),
  ) as Record<string, LeadPreset | undefined>;

  const field: DropdownFieldDef = {
    kind: "dropdown",
    id: "lead-vocs-mic",
    label: "Mic",
    hideVisibleLabel: true,
    ariaLabel: "Mic",
    options: () => ORDER.map((item) => ({ value: item.id, label: item.label })),
    getValue: (state) => readCurrent(state, byId),
    setValue: (state, value) => withInputsTarget(state.defaultPreset.inputs, state.patch, byId[value]?.inputs ?? state.defaultPreset.inputs),
    isDefault: (state) => readCurrent(state, byId) === readDefault(state, byId),
    reset: (state) => withInputsTarget(state.defaultPreset.inputs, state.patch, state.defaultPreset.inputs),
  };

  return [field];
}
