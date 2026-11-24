import type {
  Musician,
  PresetEntity,
} from "../../../../../../src/domain/model/types";
import { deriveVocalOverlaysFromLineup } from "../../../../../../src/domain/project/deriveVocalOverlaysFromLineup";
import { resolveMusicianHasVocalCapability } from "../../../../../../src/domain/project/resolveMusicianHasVocalCapability";

export type DerivedVocalOverlayResult = {
  readonly leadVocalIds: string[];
  readonly backVocalIds: string[];
  /** `false` = volající nemusí přepisovat stav ani zapínat override. */
  readonly didChange: boolean;
};

/**
 * Co? Napojí doménovou derivaci overlays na katalog presetů: z muzikantů
 * sestavy udělá predikát „umí zpívat" a předá ho
 * `deriveVocalOverlaysFromLineup`.
 *
 * Proč zvlášť? Volají to dvě cesty na `ProjectSetupPage` — změna lineupu
 * (`setRoleSlots`) a přepočet při otevření projektu — a obě potřebují stejné
 * složení predikátu z `presetCatalog`. Doména sama katalog znát nesmí.
 *
 * `enforceVocalSelectionInvariant` se tady nevolá: derivace lead vokalisty
 * z kandidátů na back odečítá, takže invariant je splněný konstrukcí a druhé
 * volání by dalo druhé pravidlo o téže věci. Invariant zůstává na cestách,
 * kde výběr přichází od uživatele z modálů.
 */
export function applyDerivedVocalOverlays(args: {
  lineupMusicians: readonly Musician[];
  leadVocalIds: readonly string[];
  backVocalIds: readonly string[];
  presetCatalog: Record<string, PresetEntity | undefined>;
}): DerivedVocalOverlayResult {
  const musicianById = new Map(
    args.lineupMusicians.map((musician) => [musician.id, musician]),
  );

  const derived = deriveVocalOverlaysFromLineup({
    lineupMusicianIds: args.lineupMusicians.map((musician) => musician.id),
    leadVocalIds: args.leadVocalIds,
    backVocalIds: args.backVocalIds,
    canSing: (musicianId) => {
      const musician = musicianById.get(musicianId);
      return musician
        ? resolveMusicianHasVocalCapability(musician, args.presetCatalog)
        : false;
    },
  });

  return {
    leadVocalIds: [...derived.leadVocalIds],
    backVocalIds: [...derived.backVocalIds],
    didChange: derived.didChange,
  };
}
