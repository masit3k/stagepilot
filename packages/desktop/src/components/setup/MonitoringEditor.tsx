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
  const currentConnection = patch?.monitoring?.connection ?? effectiveMonitoring.connection ?? "wired";

  return (
    <section>
      <h4>Monitoring</h4>
      <label>
        Type
        <div className="setup-field-row">
          <select
            value={currentType}
            onChange={(e) =>
              onChangePatch({
                ...patch,
                monitoring: { ...patch?.monitoring, type: e.target.value as "wedge" | "iem" | "none" },
              })
            }
          >
            <option value="wedge">Wedge</option>
            <option value="iem">IEM</option>
            <option value="none">None</option>
          </select>
          <span className={diffMeta.monitoring.type.origin === "override" ? "setup-badge setup-badge--override" : "setup-badge"}>
            {diffMeta.monitoring.type.origin === "override" ? "Overridden" : "Default"}
          </span>
        </div>
      </label>

      {currentType === "iem" ? (
        <label>
          Connection
          <div className="setup-field-row">
            <select
              value={currentConnection}
              onChange={(e) =>
                onChangePatch({
                  ...patch,
                  monitoring: { ...patch?.monitoring, connection: e.target.value as "wired" | "wireless" },
                })
              }
            >
              <option value="wired">Wired</option>
              <option value="wireless">Wireless</option>
            </select>
            <span className={diffMeta.monitoring.connection.origin === "override" ? "setup-badge setup-badge--override" : "setup-badge"}>
              {diffMeta.monitoring.connection.origin === "override" ? "Overridden" : "Default"}
            </span>
          </div>
        </label>
      ) : null}

      {currentType === "iem" ? (
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
      ) : null}
    </section>
  );
}
