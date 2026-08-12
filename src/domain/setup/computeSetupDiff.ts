import type { MusicianSetupPreset, PresetOverridePatch } from "../model/types.js";
import { resolvePresetIdAlias } from "../model/presetAliases.js";

export type SetupDiffOrigin = "default" | "override";
export type SetupChangeType = "added" | "removed" | "unchanged";

export type InputDiffMeta = {
  key: string;
  label: string;
  origin: SetupDiffOrigin;
  changeType: SetupChangeType;
};

export type MonitoringFieldDiffMeta = {
  origin: SetupDiffOrigin;
  changeType: SetupChangeType;
};

export type SetupDiffMeta = {
  inputs: InputDiffMeta[];
  monitoring: {
    monitorRef: MonitoringFieldDiffMeta;
    additionalWedgeCount: MonitoringFieldDiffMeta;
  };
};

export function computeSetupDiff(params: {
  defaultPreset: MusicianSetupPreset;
  effectivePreset: MusicianSetupPreset;
  eventOverride?: PresetOverridePatch;
}): SetupDiffMeta {
  const { defaultPreset, effectivePreset, eventOverride } = params;
  const removedKeys = new Set([...(eventOverride?.inputs?.remove ?? []), ...(eventOverride?.inputs?.removeKeys ?? [])]);
  const addedKeys = new Set((eventOverride?.inputs?.add ?? []).map((input) => input.key));

  const inputs: InputDiffMeta[] = [];
  const effectiveByKey = new Map(effectivePreset.inputs.map((item) => [item.key, item]));

  for (const item of defaultPreset.inputs) {
    if (removedKeys.has(item.key)) {
      inputs.push({ key: item.key, label: item.label, origin: "override", changeType: "removed" });
      continue;
    }
    const effective = effectiveByKey.get(item.key);
    inputs.push({
      key: item.key,
      label: effective?.label ?? item.label,
      origin: "default",
      changeType: "unchanged",
    });
  }

  for (const item of effectivePreset.inputs) {
    if (addedKeys.has(item.key)) {
      inputs.push({ key: item.key, label: item.label, origin: "override", changeType: "added" });
    }
  }

  function fieldMeta(hasOverride: boolean): MonitoringFieldDiffMeta {
    return {
      origin: hasOverride ? "override" : "default",
      changeType: hasOverride ? "added" : "unchanged",
    };
  }

  // Real user data may hold a legacy monitor id (e.g. "iem_stereo_wireless")
  // where the current catalog uses its canonical alias (e.g. "..._foh"). Resolve
  // both sides before comparing so re-selecting the already-active supplier
  // does not surface as a spurious "modified" badge.
  const overrideMonitorRef = eventOverride?.monitoring?.monitorRef;
  const monitorRefChanged =
    overrideMonitorRef !== undefined &&
    resolvePresetIdAlias(overrideMonitorRef) !== resolvePresetIdAlias(defaultPreset.monitoring.monitorRef);

  const additionalWedgeCountChanged = eventOverride?.monitoring?.additionalWedgeCount !== undefined;

  return {
    inputs,
    monitoring: {
      monitorRef: fieldMeta(monitorRefChanged),
      additionalWedgeCount: fieldMeta(additionalWedgeCountChanged),
    },
  };
}
