export type DerivedVocalOverlays = {
  readonly leadVocalIds: readonly string[];
  readonly backVocalIds: readonly string[];
  /** `false` = volající nemusí přepisovat stav ani zapínat override. */
  readonly didChange: boolean;
};

/**
 * Co? Odvodí vokální overlays ze sestavy: `backVocals` = všichni členové
 * lineupu s vokální capability MINUS lead vokalisté, `leadVocals` = uložený
 * výběr protnutý se sestavou.
 *
 * Proč odvozená množina, ne dědění pozice? Capability je zdroj pravdy o tom,
 * kdo zpívá. Předchůdce na slotu o tom nic neříká — basák, který umí zpívat,
 * má být v back vokálech, i když basák před ním nezpíval. Dřívější pravidlo
 * „dědí se jen role, kterou předchůdce držel" (`reconcileOverlaysAfterLineupChange`)
 * nechávalo zpívající členy sestavy mimo overlays podle toho, kdo na slotu
 * stál dřív.
 *
 * Pořadí: pořadí `lineupMusicianIds`, ne pořadí předchozího výběru. Musí být
 * deterministické, jinak by se projekt měnil při každém otevření. Pořadí na
 * PDF tohle neurčuje — o to se stará poziční had (`vocalOrderRank`
 * v `buildDocument`), tady jde jen o stabilní tvar uloženého pole.
 *
 * Idempotence: druhé zavolání nad už odvozeným stavem vrátí `didChange: false`.
 * Na tom stojí přepočet při otevření projektu — bez toho by otevření označilo
 * projekt jako neuložený.
 *
 * Čistá funkce: žádné I/O, capability přichází jako injektovaný predikát, aby
 * doména nemusela znát katalog presetů ani `packages/desktop`.
 *
 * Invariant lead+back je tu splněný konstrukcí (lead se z kandidátů odečte),
 * takže `enforceVocalSelectionInvariant` nad výsledkem nic nezmění.
 */
export function deriveVocalOverlaysFromLineup(args: {
  lineupMusicianIds: readonly string[];
  leadVocalIds: readonly string[];
  backVocalIds?: readonly string[];
  canSing: (musicianId: string) => boolean;
}): DerivedVocalOverlays {
  const lineupIds = dedupeNonBlank(args.lineupMusicianIds);
  const lineupIdSet = new Set(lineupIds);

  const leadVocalIds = dedupeNonBlank(args.leadVocalIds).filter((musicianId) =>
    lineupIdSet.has(musicianId),
  );
  const leadIdSet = new Set(leadVocalIds);

  const backVocalIds = lineupIds.filter(
    (musicianId) => !leadIdSet.has(musicianId) && args.canSing(musicianId),
  );

  return {
    leadVocalIds,
    backVocalIds,
    didChange:
      !isSameOrder(leadVocalIds, dedupeNonBlank(args.leadVocalIds)) ||
      !isSameOrder(backVocalIds, dedupeNonBlank(args.backVocalIds ?? [])),
  };
}

function dedupeNonBlank(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
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
