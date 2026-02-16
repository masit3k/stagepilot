import type { MonitoringPreset, MusicianSetupPreset, PresetOverridePatch } from "../model/types.js";

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
    type: MonitoringFieldDiffMeta;
    mode: MonitoringFieldDiffMeta;
    mixCount: MonitoringFieldDiffMeta;
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

  function monitoringMeta<K extends keyof MonitoringPreset>(field: K): MonitoringFieldDiffMeta {
    const hasOverride = eventOverride?.monitoring?.[field] !== undefined;
    return {
      origin: hasOverride ? "override" : "default",
      changeType: hasOverride ? "added" : "unchanged",
    };
  }

  return {
    inputs,
    monitoring: {
      type: monitoringMeta("type"),
      mode: monitoringMeta("mode"),
      mixCount: monitoringMeta("mixCount"),
    },
  };
}
