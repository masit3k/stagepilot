import type {
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../src/domain/model/types";
import type {
  SetupDiffMeta,
  SetupDiffOrigin,
} from "../../../../../src/domain/setup/computeSetupDiff";
import { SetupCounterControl } from "../../app/components/setup/fields/SetupCounterControl";
export const MIN_ADDITIONAL_WEDGE_COUNT = 1;
export const MAX_ADDITIONAL_WEDGE_COUNT = 4;

export function clampAdditionalWedgeCount(value: number): number {
  return Math.min(
    MAX_ADDITIONAL_WEDGE_COUNT,
    Math.max(MIN_ADDITIONAL_WEDGE_COUNT, value),
  );
}

export function isAdditionalWedgeEnabled(
  additionalWedgeCount: number | undefined,
): boolean {
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

export function MonitoringEditor({
  monitorOptions,
  effectiveMonitoring,
  patch,
  diffMeta,
  onChangePatch,
}: MonitoringEditorProps) {
  const additionalWedgeControlId = "setup-additional-wedge";
  const currentMonitorRef =
    patch?.monitoring?.monitorRef ?? effectiveMonitoring.monitorRef ?? "";
  const hasCurrentMonitorOption = monitorOptions.some(
    (option) => option.value === currentMonitorRef,
  );
  const normalizedMonitorRef = hasCurrentMonitorOption ? currentMonitorRef : "";
  const explicitAdditionalWedgeCount = patch?.monitoring?.additionalWedgeCount;
  const effectiveAdditionalWedgeCount =
    effectiveMonitoring.additionalWedgeCount;
  const hasAdditionalWedge =
    isAdditionalWedgeEnabled(explicitAdditionalWedgeCount) ||
    (!isAdditionalWedgeEnabled(explicitAdditionalWedgeCount) &&
      isAdditionalWedgeEnabled(effectiveAdditionalWedgeCount));
  const currentAdditionalWedgeCount = clampAdditionalWedgeCount(
    explicitAdditionalWedgeCount ??
      effectiveAdditionalWedgeCount ??
      MIN_ADDITIONAL_WEDGE_COUNT,
  );
  const monitorModified = isMonitoringFieldModified(
    diffMeta.monitoring.monitorRef.origin,
  );
  const additionalWedgeModified = isMonitoringFieldModified(
    diffMeta.monitoring.additionalWedgeCount.origin,
  );

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
      <label
        className={`setup-field-block ${monitorModified ? "setup-field-block--modified" : ""}`}
      >
        <div className="setup-field-row">
          <select
            className="setup-field-control"
            aria-label="Monitoring"
            value={normalizedMonitorRef}
            onChange={(e) =>
              onChangePatch({
                ...patch,
                monitoring: {
                  ...patch?.monitoring,
                  monitorRef: e.target.value,
                },
              })
            }
          >
            {monitorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="">No monitor selected</option>
          </select>
        </div>
      </label>

      <div className="setup-toggle-grid">
        <div
          className={`setup-field-block ${additionalWedgeModified ? "setup-field-block--modified" : ""}`}
        >
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
                updateAdditionalWedgeCount(
                  e.target.checked ? currentAdditionalWedgeCount : undefined,
                );
              }}
            />
            <span className="setup-toggle-row__text">
              Additional wedge monitor
            </span>
            {hasAdditionalWedge ? (
              <span
                className="setup-toggle-row__trailing"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <SetupCounterControl
                  label="Additional wedges"
                  value={currentAdditionalWedgeCount}
                  min={MIN_ADDITIONAL_WEDGE_COUNT}
                  max={MAX_ADDITIONAL_WEDGE_COUNT}
                  disabled={!hasAdditionalWedge}
                  stopPropagation
                  onChange={(nextCount) =>
                    updateAdditionalWedgeCount(
                      clampAdditionalWedgeCount(nextCount),
                    )
                  }
                />
              </span>
            ) : null}
          </label>
        </div>
      </div>
    </div>
  );
}
