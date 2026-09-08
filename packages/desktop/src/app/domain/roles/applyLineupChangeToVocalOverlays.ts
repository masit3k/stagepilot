import {
  type LineupSlotChange,
  reconcileOverlaysAfterLineupChange,
} from "../../../../../../src/domain/project/reconcileOverlaysAfterLineupChange";
import { enforceVocalSelectionInvariant } from "./vocalSelectionInvariant";

export type VocalOverlayChangeResult = {
  readonly leadVocalIds: string[];
  readonly backVocalIds: string[];
  /** `false` = volající nemusí přepisovat stav ani zapínat override. */
  readonly didChange: boolean;
};

/**
 * Co? Složí doménovou derivaci overlays po změně lineupu s invariantem
 * dvojrole: `reconcileOverlaysAfterLineupChange` dosadí náhrady na pozice
 * odcházejících, `enforceVocalSelectionInvariant` pak sundá z back vokálů
 * toho, kdo právě zpívá lead.
 *
 * Proč zvlášť? Obě obrazovky, které lineup mění, potřebují tutéž dvojici ve
 * stejném pořadí, a `ProjectSetupPage` ji volá ze dvou míst (`updateSlot`
 * a commit z modálu `Change`). Bez tohoto helperu by pořadí obou kroků bylo
 * naklonované na třech místech.
 *
 * `lineupCandidateIds` schválně dostává jen id, která už v overlays jsou:
 * kandidátskou množinu si stránka počítá vlastním memem až z nového lineupu,
 * takže kdyby se sem poslala ta stará, invariant by odstřelil právě
 * nastupujícího muzikanta.
 */
export function applyLineupChangeToVocalOverlays(args: {
  leadVocalIds: readonly string[];
  backVocalIds: readonly string[];
  slotChanges: readonly LineupSlotChange[];
  canSing: (musicianId: string) => boolean;
}): VocalOverlayChangeResult {
  const overlays = {
    leadVocals: args.leadVocalIds,
    backVocals: args.backVocalIds,
  };
  const reconciled = reconcileOverlaysAfterLineupChange({
    overlays,
    slotChanges: args.slotChanges,
    canSing: args.canSing,
  });

  const { leadIds, backIds } = enforceVocalSelectionInvariant({
    lineupCandidateIds: [...reconciled.leadVocals, ...reconciled.backVocals],
    leadIds: reconciled.leadVocals,
    backIds: reconciled.backVocals,
  });

  return {
    leadVocalIds: leadIds,
    backVocalIds: backIds,
    didChange:
      !isSameOrder(leadIds, args.leadVocalIds) ||
      !isSameOrder(backIds, args.backVocalIds),
  };
}

function isSameOrder(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
