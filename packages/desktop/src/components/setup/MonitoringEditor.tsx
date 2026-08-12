import type {
  Monitor,
  MonitorSupplier,
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../src/domain/model/types";
import type {
  SetupDiffMeta,
  SetupDiffOrigin,
} from "../../../../../src/domain/setup/computeSetupDiff";
import { SetupCounterControl } from "../../app/components/setup/fields/SetupCounterControl";
import {
  buildMonitorAxes,
  resolveMonitorRef,
  resolveMonitorSelection,
} from "./monitorAxes";
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

type MonitoringEditorProps = {
  monitors: Monitor[];
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  patch?: PresetOverridePatch;
  diffMeta: SetupDiffMeta;
  onChangePatch: (next: PresetOverridePatch) => void;
};

export function MonitoringEditor({
  monitors,
  effectiveMonitoring,
  patch,
  diffMeta,
  onChangePatch,
}: MonitoringEditorProps) {
  const additionalWedgeControlId = "setup-additional-wedge";
  const supplierLabelId = "setup-monitor-supplier";
  const axes = buildMonitorAxes(monitors);
  const currentMonitorRef =
    patch?.monitoring?.monitorRef ?? effectiveMonitoring.monitorRef ?? "";
  const selection = resolveMonitorSelection(axes, currentMonitorRef);

  const commitMonitorRef = (nextRef: string | undefined) => {
    onChangePatch({
      ...patch,
      monitoring: { ...patch?.monitoring, monitorRef: nextRef ?? "" },
    });
  };
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
            value={selection?.typeKey ?? ""}
            onChange={(e) =>
              commitMonitorRef(
                resolveMonitorRef(
                  axes,
                  e.target.value,
                  selection?.supplier ?? "foh",
                ),
              )
            }
          >
            {axes.types.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
            {selection ? null : <option value="">No monitor selected</option>}
          </select>
        </div>
      </label>

      <div className="setup-field-block">
        <span className="setup-field-block__label" id={supplierLabelId}>
          Monitor supplier
        </span>
        <div
          className="setup-field-row setup-supplier-switch"
          role="group"
          aria-labelledby={supplierLabelId}
        >
          {(["band", "foh"] as MonitorSupplier[]).map((supplier) => (
            <button
              key={supplier}
              type="button"
              className={`setup-supplier-switch__option ${
                selection?.supplier === supplier
                  ? "setup-supplier-switch__option--active"
                  : ""
              }`}
              aria-pressed={selection?.supplier === supplier}
              disabled={!selection}
              onClick={() =>
                commitMonitorRef(
                  resolveMonitorRef(axes, selection?.typeKey ?? "", supplier),
                )
              }
            >
              {supplier === "band" ? "Band" : "FOH"}
            </button>
          ))}
        </div>
      </div>

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
