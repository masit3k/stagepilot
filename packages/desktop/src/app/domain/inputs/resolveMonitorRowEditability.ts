import type { Group } from "../../../../../../src/domain/model/groups";

/**
 * Co? Jestli lze editovat monitoring vybraného řádku sekce MONITORS, a pokud
 * ne, proč — panel potřebuje obojí, aby needitovatelný stav vysvětlil (task
 * 12c precedens pro `InputRowInspector`'s `labelIsCanonical`), ne jen tiše
 * zakázal.
 *
 * Zbývá jediný důvod: `no-slot`, tedy vlastník monitoru nemá slot v
 * `project.lineup`, kam by šel patch zapsat (zrcadlí `InputRowInspector`'s
 * `canEditSlot`).
 *
 * Brána `drums-not-supported` padla s F5d R3 — `resolveEffectiveProjectSetup`
 * u role `drums` `presetOverride.monitoring` nově čte a nevalidní `monitorRef`
 * na bicím slotu hodí stejnou chybu jako na basovém. Bicí slot je tím u
 * monitoringu srovnaný s ostatními rolemi a UI nemá co zavírat. Vstupní sestra
 * `resolveInputRowEditability` svoji bránu `drums-not-supported` naopak
 * **drží** (R2): bicí kanály staví `drumDefinition`, ne preset, takže
 * `add`/`removeKeys` do dokumentu dál nedojede.
 */
export type MonitorRowEditability =
  | { canEdit: true }
  | { canEdit: false; reason: "no-slot" };

export function resolveMonitorRowEditability(args: {
  slotKey: string;
  ownerRole: Group;
}): MonitorRowEditability {
  void args.ownerRole;
  if (!args.slotKey) return { canEdit: false, reason: "no-slot" };
  return { canEdit: true };
}
