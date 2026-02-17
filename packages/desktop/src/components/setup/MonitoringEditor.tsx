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

  const updateAdditionalWedgeCount = (count: number | undefined) => {
    onChangePatch({
      ...patch,
      monitoring: {
        ...patch?.monitoring,
        additionalWedgeCount: count,
      },
    });
  };

  return (
    <div className="setup-editor-stack">
      <label className={`setup-field-block ${monitorModified ? "setup-field-block--modified" : ""}`}>
        <div className="setup-field-row">
          <select
            className="setup-field-control"
            aria-label="Monitoring"
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
        </div>
      </label>

      <div className="setup-toggle-grid">
        <div
          className={`setup-toggle-row ${hasAdditionalWedge ? "setup-toggle-row--checked" : ""} ${additionalWedgeModified ? "setup-field-block--modified" : ""}`}
        >
          <input
            id="setup-additional-wedge"
            className="setup-checkbox"
            type="checkbox"
            checked={hasAdditionalWedge}
            onChange={(e) => {
              updateAdditionalWedgeCount(e.target.checked ? currentAdditionalWedgeCount : undefined);
            }}
          />
          <label className="setup-toggle-row__text" htmlFor="setup-additional-wedge">Additional wedge</label>
          {hasAdditionalWedge ? (
            <div className="setup-toggle-row__trailing">
              <button
                type="button"
                className="button-secondary setup-stepper__btn"
                aria-label="Decrease additional wedge count"
                disabled={currentAdditionalWedgeCount <= 1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChangePatch({
                    ...patch,
                    monitoring: {
                      ...patch?.monitoring,
                      additionalWedgeCount: Math.max(1, currentAdditionalWedgeCount - 1),
                    },
                  });
                }}
              >
                −
              </button>
              <span className="setup-stepper__value" aria-live="polite">{currentAdditionalWedgeCount}</span>
              <button
                type="button"
                className="button-secondary setup-stepper__btn"
                aria-label="Increase additional wedge count"
                disabled={currentAdditionalWedgeCount >= 4}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChangePatch({
                    ...patch,
                    monitoring: {
                      ...patch?.monitoring,
                      additionalWedgeCount: Math.min(4, currentAdditionalWedgeCount + 1),
                    },
                  });
                }}
              >
                +
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
