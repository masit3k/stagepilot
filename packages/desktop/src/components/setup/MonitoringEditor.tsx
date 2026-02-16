import type { MusicianSetupPreset, PresetOverridePatch } from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";

type MonitoringEditorProps = {
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  patch?: PresetOverridePatch;
  diffMeta: SetupDiffMeta;
  onChangePatch: (next: PresetOverridePatch) => void;
};

export function MonitoringEditor({ effectiveMonitoring, patch, diffMeta, onChangePatch }: MonitoringEditorProps) {
  const currentType = patch?.monitoring?.type ?? effectiveMonitoring.type;
  const typeModified = diffMeta.monitoring.type.origin === "override";
  const modeModified = diffMeta.monitoring.mode.origin === "override";

  return (
    <div className="setup-monitoring-grid">
      <label className={`setup-field-block ${typeModified ? "setup-field-block--modified" : ""}`}>
        <span className="setup-field-block__label">Monitoring Type</span>
        <div className="setup-field-row">
          <select
            className="setup-field-control"
            value={currentType}
            onChange={(e) =>
              onChangePatch({
                ...patch,
                monitoring: { ...patch?.monitoring, type: e.target.value as "wedge" | "iem_wired" | "iem_wireless" },
              })
            }
          >
            <option value="iem_wireless">IEM wireless</option>
            <option value="iem_wired">IEM wired</option>
            <option value="wedge">Wedge</option>
          </select>
          {typeModified ? <span className="setup-modified-dot" aria-label="Modified from defaults" title="Modified from defaults">●</span> : null}
        </div>
      </label>

      {currentType !== "wedge" ? (
        <label className={`setup-field-block ${modeModified ? "setup-field-block--modified" : ""}`}>
          <span className="setup-field-block__label">Mode</span>
          <div className="setup-field-row">
            <select
              className="setup-field-control"
              value={patch?.monitoring?.mode ?? effectiveMonitoring.mode}
              onChange={(e) =>
                onChangePatch({
                  ...patch,
                  monitoring: { ...patch?.monitoring, mode: e.target.value as "mono" | "stereo" },
                })
              }
            >
              <option value="mono">Mono</option>
              <option value="stereo">Stereo</option>
            </select>
            {modeModified ? <span className="setup-modified-dot" aria-label="Modified from defaults" title="Modified from defaults">●</span> : null}
          </div>
        </label>
      ) : null}
    </div>
  );
}
