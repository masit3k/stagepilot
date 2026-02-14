import type { MusicianSetupPreset, PresetOverridePatch } from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";

type MonitoringEditorProps = {
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  patch?: PresetOverridePatch;
  diffMeta: SetupDiffMeta;
  onChangePatch: (next: PresetOverridePatch) => void;
};

export function MonitoringEditor({ effectiveMonitoring, patch, diffMeta, onChangePatch }: MonitoringEditorProps) {
  return (
    <section>
      <h4>Monitoring</h4>
      <label>
        Type
        <div className="setup-field-row">
          <select
            value={patch?.monitoring?.type ?? effectiveMonitoring.type}
            onChange={(e) =>
              onChangePatch({
                ...patch,
                monitoring: { ...patch?.monitoring, type: e.target.value as "wedge" | "iem" },
              })
            }
          >
            <option value="wedge">Wedge</option>
            <option value="iem">IEM</option>
          </select>
          <span className={diffMeta.monitoring.type.origin === "override" ? "setup-badge setup-badge--override" : "setup-badge"}>
            {diffMeta.monitoring.type.origin === "override" ? "Overridden" : "Default"}
          </span>
        </div>
      </label>
      <label>
        Mode
        <div className="setup-field-row">
          <select
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
          <span className={diffMeta.monitoring.mode.origin === "override" ? "setup-badge setup-badge--override" : "setup-badge"}>
            {diffMeta.monitoring.mode.origin === "override" ? "Overridden" : "Default"}
          </span>
        </div>
      </label>
      <label>
        Mixes
        <div className="setup-field-row">
          <input
            type="number"
            min={0}
            max={6}
            value={patch?.monitoring?.mixCount ?? effectiveMonitoring.mixCount}
            onChange={(e) =>
              onChangePatch({
                ...patch,
                monitoring: { ...patch?.monitoring, mixCount: Number(e.target.value || 0) },
              })
            }
          />
          <span className={diffMeta.monitoring.mixCount.origin === "override" ? "setup-badge setup-badge--override" : "setup-badge"}>
            {diffMeta.monitoring.mixCount.origin === "override" ? "Overridden" : "Default"}
          </span>
        </div>
      </label>
    </section>
  );
}
