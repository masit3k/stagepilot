import type { MusicianSetupPreset, PresetOverridePatch } from "../../../../../src/domain/model/types";
import type { SetupDiffMeta, SetupDiffOrigin } from "../../../../../src/domain/setup/computeSetupDiff";
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

type MonitoringOption = { value: string; label: string };

type MonitoringEditorProps = {
  monitorOptions: MonitoringOption[];
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  patch?: PresetOverridePatch;
  diffMeta: SetupDiffMeta;
  onChangePatch: (next: PresetOverridePatch) => void;
};

export function MonitoringEditor({ monitorOptions, effectiveMonitoring, patch, diffMeta, onChangePatch }: MonitoringEditorProps) {
  const additionalWedgeControlId = "setup-additional-wedge";
  const currentMonitorRef = patch?.monitoring?.monitorRef ?? effectiveMonitoring.monitorRef;
  const explicitAdditionalWedgeCount = patch?.monitoring?.additionalWedgeCount;
  const effectiveAdditionalWedgeCount = effectiveMonitoring.additionalWedgeCount;
  const hasAdditionalWedge = isAdditionalWedgeEnabled(explicitAdditionalWedgeCount)
    || (!isAdditionalWedgeEnabled(explicitAdditionalWedgeCount) && isAdditionalWedgeEnabled(effectiveAdditionalWedgeCount));
  const currentAdditionalWedgeCount = clampAdditionalWedgeCount(
    explicitAdditionalWedgeCount ?? effectiveAdditionalWedgeCount ?? MIN_ADDITIONAL_WEDGE_COUNT,
  );
  const monitorModified = isMonitoringFieldModified(diffMeta.monitoring.monitorRef.origin);
  const additionalWedgeModified = isMonitoringFieldModified(diffMeta.monitoring.additionalWedgeCount.origin);

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
            {monitorOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </label>

      <div className="setup-toggle-grid">
        <div className={`setup-field-block ${additionalWedgeModified ? "setup-field-block--modified" : ""}`}>
          <label
            className={`setup-field-row setup-toggle-row ${hasAdditionalWedge ? "setup-toggle-row--checked" : ""}`}
            htmlFor={additionalWedgeControlId}
            role="group"
          >
            <input
              id={additionalWedgeControlId}
              className="setup-checkbox"
              type="checkbox"
              checked={hasAdditionalWedge}
              onChange={(e) => {
                updateAdditionalWedgeCount(e.target.checked ? currentAdditionalWedgeCount : undefined);
              }}
            />
            <span className="setup-toggle-row__text">Additional wedge monitor</span>
            {hasAdditionalWedge ? (
              <span
                className="setup-toggle-row__trailing"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="setup-stepper">
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
              </span>
            ) : null}
          </label>
        </div>
      </div>
    </div>
  );
}
