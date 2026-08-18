import type { Group } from "../../../../../../src/domain/model/groups";

/**
 * Co? Jestli lze editovat monitoring vybraného řádku sekce MONITORS (R7), a
 * pokud ne, proč — panel potřebuje obojí, aby needitovatelný stav vysvětlil
 * (task 12c precedens pro `InputRowInspector`'s `labelIsCanonical`), ne jen
 * tiše zakázal.
 *
 * Dva navzájem nezávislé důvody vedou ke stejnému závěru:
 *
 * - `no-slot`: vlastník monitoru nemá slot v `project.lineup`, kam by patch
 *   šel zapsat (zrcadlí `InputRowInspector`'s `canEditSlot`).
 * - `drums-not-supported`: `resolveEffectiveProjectSetup` u role `drums`
 *   `presetOverride.monitoring` vědomě ignoruje
 *   (`src/domain/setup/resolveEffectiveProjectSetup.ts:81-90`, task 12c fix
 *   round 1, commit `5d1ff86`) — patch by se tiše uložil, ale dokument by ho
 *   nikdy nepřečetl. UI proto nesmí nabídnout editaci, která nedojede.
 *
 * Když platí obojí, vrací se `no-slot` — bez slotu není kam patch zapsat, což
 * je důvod, který zablokuje editaci pro každou roli, ne jen pro bicí.
 */
export type MonitorRowEditability =
  | { canEdit: true }
  | { canEdit: false; reason: "no-slot" | "drums-not-supported" };

export function resolveMonitorRowEditability(args: {
  slotKey: string;
  ownerRole: Group;
}): MonitorRowEditability {
  if (!args.slotKey) return { canEdit: false, reason: "no-slot" };
  if (args.ownerRole === "drums") {
    return { canEdit: false, reason: "drums-not-supported" };
  }
  return { canEdit: true };
}
