import type { Group } from "../../../../../src/domain/model/groups";
import type {
  Monitor,
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import { resolveMonitorRowEditability } from "../../app/domain/inputs/resolveMonitorRowEditability";
import { MonitoringEditor } from "./MonitoringEditor";

/**
 * Co? Gate pro `MonitoringEditor` v setup modálu na obrazovce `01` (task
 * 19a) — zrcadlí task 15's `MonitorRowInspector` pro sekci MONITORS (R7) na
 * obrazovce `02`. `resolveEffectiveProjectSetup.ts:81-90` u role `drums`
 * `presetOverride.monitoring` vědomě ignoruje (task 12c fix round 1), takže
 * modál nesmí nabídnout editaci, která se tiše nikdy neprojeví v dokumentu.
 *
 * Vstupní tvar (`slotKey`, `ownerRole`) je totožný s `MonitorRowInspector`'s
 * voláním `resolveMonitorRowEditability` — modál pracuje přímo se slotem
 * lineupu (`selectedSetupMusician`), ne s řádkem tabulky, ale obojí sdílí
 * stejné dva důvody needitovatelnosti, takže žádná sesterská čistá funkce
 * nebyla potřeba.
 */
export function SetupMonitoringEditor({
  slotKey,
  ownerRole,
  monitors,
  effectiveMonitoring,
  patch,
  diffMeta,
  onChangePatch,
}: {
  slotKey: string;
  ownerRole: Group;
  monitors: Monitor[];
  effectiveMonitoring: MusicianSetupPreset["monitoring"];
  patch?: PresetOverridePatch;
  diffMeta: SetupDiffMeta;
  onChangePatch: (next: PresetOverridePatch) => void;
}) {
  const editability = resolveMonitorRowEditability({ slotKey, ownerRole });

  if (!editability.canEdit) {
    return (
      <p className="subtle">
        {editability.reason === "drums-not-supported"
          ? "Drum monitoring isn't picked up by the printed document yet — not editable here."
          : "Not editable — this slot has no assigned lineup position."}
      </p>
    );
  }

  return (
    <MonitoringEditor
      monitors={monitors}
      effectiveMonitoring={effectiveMonitoring}
      patch={patch}
      diffMeta={diffMeta}
      onChangePatch={onChangePatch}
    />
  );
}
