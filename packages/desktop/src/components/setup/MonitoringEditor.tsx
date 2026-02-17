import type { MusicianSetupPreset, PresetOverridePatch } from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import iemStereoWirelessPreset from "../../../../../data/assets/presets/monitors/iem_stereo_wireless.json";
import iemStereoWiredPreset from "../../../../../data/assets/presets/monitors/iem_stereo_wired.json";
import iemMonoWirelessPreset from "../../../../../data/assets/presets/monitors/iem_mono_wireless.json";
import iemMonoWiredPreset from "../../../../../data/assets/presets/monitors/iem_mono_wired.json";
import wedgePreset from "../../../../../data/assets/presets/monitors/wedge.json";

const MONITOR_OPTIONS = [
  iemStereoWirelessPreset,
  iemStereoWiredPreset,
  iemMonoWirelessPreset,
  iemMonoWiredPreset,
  wedgePreset,
].map((preset) => ({ value: preset.id, label: preset.label }));

type MonitoringEditorProps = {
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  patch?: PresetOverridePatch;
  diffMeta: SetupDiffMeta;
  onChangePatch: (next: PresetOverridePatch) => void;
};

export function MonitoringEditor({ effectiveMonitoring, patch, diffMeta, onChangePatch }: MonitoringEditorProps) {
  const currentMonitorRef = patch?.monitoring?.monitorRef ?? effectiveMonitoring.monitorRef;
  const hasAdditionalWedge = patch?.monitoring?.additionalWedgeCount !== undefined
    ? true
    : effectiveMonitoring.additionalWedgeCount !== undefined;
  const currentAdditionalWedgeCount = patch?.monitoring?.additionalWedgeCount ?? effectiveMonitoring.additionalWedgeCount ?? 1;
  const monitorModified = diffMeta.monitoring.monitorRef.origin === "override";
  const additionalWedgeModified = diffMeta.monitoring.additionalWedgeCount.origin === "override";

  return (
    <div className="setup-monitoring-grid">
      <label className={`setup-field-block ${monitorModified ? "setup-field-block--modified" : ""}`}>
        <span className="setup-field-block__label">Monitoring Type</span>
        <div className="setup-field-row">
          <select
            className="setup-field-control"
            value={currentMonitorRef}
            onChange={(e) =>
              onChangePatch({
                ...patch,
                monitoring: { ...patch?.monitoring, monitorRef: e.target.value },
              })
            }
          >
            {MONITOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {monitorModified ? <span className="setup-modified-dot" aria-label="Modified from defaults" title="Modified from defaults">●</span> : null}
        </div>
      </label>

      <label className={`setup-field-block ${additionalWedgeModified ? "setup-field-block--modified" : ""}`}>
        <span className="setup-field-block__label">Additional wedge</span>
        <div className="setup-field-row">
          <input
            type="checkbox"
            checked={hasAdditionalWedge}
            onChange={(e) => {
              onChangePatch({
                ...patch,
                monitoring: {
                  ...patch?.monitoring,
                  ...(e.target.checked ? { additionalWedgeCount: currentAdditionalWedgeCount } : { additionalWedgeCount: undefined }),
                },
              });
            }}
          />
          {additionalWedgeModified ? <span className="setup-modified-dot" aria-label="Modified from defaults" title="Modified from defaults">●</span> : null}
        </div>
      </label>

      {hasAdditionalWedge ? (
        <label className="setup-field-block">
          <span className="setup-field-block__label">Count</span>
          <div className="setup-field-row">
            <select
              className="setup-field-control"
              value={String(currentAdditionalWedgeCount)}
              onChange={(e) =>
                onChangePatch({
                  ...patch,
                  monitoring: { ...patch?.monitoring, additionalWedgeCount: Number(e.target.value) },
                })
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
        </label>
      ) : null}
    </div>
  );
}
