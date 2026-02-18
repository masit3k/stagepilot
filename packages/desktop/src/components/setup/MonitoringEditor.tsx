import type { MusicianSetupPreset, PresetOverridePatch } from "../../../../../src/domain/model/types";
import type { SetupDiffMeta, SetupDiffOrigin } from "../../../../../src/domain/setup/computeSetupDiff";
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

export const MIN_ADDITIONAL_WEDGE_COUNT = 1;
export const MAX_ADDITIONAL_WEDGE_COUNT = 4;

export function clampAdditionalWedgeCount(value: number): number {
  return Math.min(MAX_ADDITIONAL_WEDGE_COUNT, Math.max(MIN_ADDITIONAL_WEDGE_COUNT, value));
}

export function isAdditionalWedgeEnabled(additionalWedgeCount: number | undefined): boolean {
  return (additionalWedgeCount ?? 0) > 0;
}

export function isMonitoringFieldModified(origin: SetupDiffOrigin): boolean {
  return origin === "override";
}

type MonitoringEditorProps = {
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  patch?: PresetOverridePatch;
  diffMeta: SetupDiffMeta;
  onChangePatch: (next: PresetOverridePatch) => void;
};

export function MonitoringEditor({ effectiveMonitoring, patch, diffMeta, onChangePatch }: MonitoringEditorProps) {
  const currentMonitorRef = patch?.monitoring?.monitorRef ?? effectiveMonitoring.monitorRef;
  const explicitAdditionalWedgeCount = patch?.monitoring?.additionalWedgeCount;
  const effectiveAdditionalWedgeCount = effectiveMonitoring.additionalWedgeCount;
  const hasAdditionalWedge = isAdditionalWedgeEnabled(explicitAdditionalWedgeCount)
    || (!isAdditionalWedgeEnabled(explicitAdditionalWedgeCount) && isAdditionalWedgeEnabled(effectiveAdditionalWedgeCount));
  const currentAdditionalWedgeCount = clampAdditionalWedgeCount(
    explicitAdditionalWedgeCount ?? effectiveAdditionalWedgeCount ?? MIN_ADDITIONAL_WEDGE_COUNT,
  );
  const monitorModified = isMonitoringFieldModified(diffMeta.monitoring.monitorRef.origin);
  const additionalWedgeModified = isMonitoringFieldModified(diffMeta.monitoring.additionalWedgeCount.origin) || hasAdditionalWedge;

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
        <div className={`setup-field-block ${additionalWedgeModified ? "setup-field-block--modified" : ""}`}>
          <div
            className={`setup-field-row setup-toggle-row ${hasAdditionalWedge ? "setup-toggle-row--checked" : ""}`}
            role="group"
            onClick={() => updateAdditionalWedgeCount(hasAdditionalWedge ? undefined : MIN_ADDITIONAL_WEDGE_COUNT)}
          >
            <input
              id="setup-additional-wedge"
              className="setup-checkbox"
              type="checkbox"
              checked={hasAdditionalWedge}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                updateAdditionalWedgeCount(e.target.checked ? currentAdditionalWedgeCount : undefined);
              }}
            />
            <label
              className="setup-toggle-row__text"
              htmlFor="setup-additional-wedge"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              Additional wedge monitor
            </label>
            {hasAdditionalWedge ? (
              <div
                className="setup-toggle-row__trailing setup-stepper"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="setup-stepper__btn"
                  aria-label="Decrease additional wedges"
                  disabled={!hasAdditionalWedge || currentAdditionalWedgeCount <= MIN_ADDITIONAL_WEDGE_COUNT}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateAdditionalWedgeCount(clampAdditionalWedgeCount(currentAdditionalWedgeCount - 1));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  −
                </button>
                <span
                  className="setup-stepper__value"
                  aria-label={`Additional wedges: ${currentAdditionalWedgeCount}`}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {currentAdditionalWedgeCount}
                </span>
                <button
                  type="button"
                  className="setup-stepper__btn"
                  aria-label="Increase additional wedges"
                  disabled={!hasAdditionalWedge || currentAdditionalWedgeCount >= MAX_ADDITIONAL_WEDGE_COUNT}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateAdditionalWedgeCount(clampAdditionalWedgeCount(currentAdditionalWedgeCount + 1));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  +
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
