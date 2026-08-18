import type {
  Monitor,
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../../src/domain/setup/computeSetupDiff";
import { MonitoringEditor } from "../../../components/setup/MonitoringEditor";
import { getRoleDisplayName } from "../../../projectRules";
import { resolveMonitorRowEditability } from "../../domain/inputs/resolveMonitorRowEditability";
import type { MonitorEditorRow } from "./MonitorTable";

/**
 * Panel vybraného řádku sekce MONITORS (R7) — zrcadlí `InputRowInspector`.
 * Needitovatelný stav se neschovává, ale zůstává vidět se zdůvodněním (task
 * 12c precedens pro `labelIsCanonical`): bicí jsou needitovatelní vždy, viz
 * `resolveMonitorRowEditability`, protože dokument jejich monitoring patch
 * vědomě ignoruje (task 12c fix round 1). Bez tohohle by úprava bubeníkova
 * monitoringu vypadala uloženě a v tichosti se nikdy neprojevila v PDF —
 * přesně vada, kvůli které vznikl 12c.
 */
export function MonitorRowInspector({
  row,
  ownerName,
  monitors,
  effectiveMonitoring,
  diffMeta,
  patch,
  onChangePatch,
}: {
  row: MonitorEditorRow | null;
  ownerName: string;
  monitors: Monitor[];
  effectiveMonitoring: MusicianSetupPreset["monitoring"] | null;
  diffMeta: SetupDiffMeta | null;
  patch: PresetOverridePatch | undefined;
  onChangePatch: (next: PresetOverridePatch) => void;
}) {
  if (!row) {
    return (
      <aside className="inputInspector" aria-label="Selected monitor">
        <div className="inputInspector__eyebrow">NO MONITOR SELECTED</div>
      </aside>
    );
  }

  const editability = resolveMonitorRowEditability({
    slotKey: row.slotKey,
    ownerRole: row.ownerRole,
  });

  return (
    <aside className="inputInspector" aria-label="Selected monitor">
      <div className="inputInspector__section">
        <div className="inputInspector__eyebrow">SELECTED MONITOR</div>
        <div className="inputInspector__title">{row.output}</div>
      </div>

      <div className="inputInspector__section">
        {editability.canEdit && effectiveMonitoring && diffMeta ? (
          <MonitoringEditor
            monitors={monitors}
            effectiveMonitoring={effectiveMonitoring}
            patch={patch}
            diffMeta={diffMeta}
            onChangePatch={onChangePatch}
          />
        ) : (
          <p className="inputInspector__hint">
            {!editability.canEdit &&
            editability.reason === "drums-not-supported"
              ? "Drum monitoring isn't picked up by the printed document yet — not editable here."
              : "Not editable — this monitor has no assigned lineup slot."}
          </p>
        )}
      </div>

      {ownerName ? (
        <>
          <hr className="inputInspector__divider" />
          <div className="inputInspector__section">
            <div className="inputInspector__row">
              <span className="inputInspector__ownerName">{ownerName}</span>
              <span className="inputInspector__ownerRole">
                {getRoleDisplayName(row.ownerRole)}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
