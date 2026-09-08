/** Jedna výměna na slotu lineupu: kdo tam byl a kdo tam je teď. */
export type LineupSlotChange = {
  readonly previousMusicianId: string;
  /** Prázdný string = slot byl vyprázdněn bez náhrady. */
  readonly nextMusicianId: string;
};

export type ReconcilableOverlays = {
  readonly leadVocals?: readonly string[];
  readonly backVocals?: readonly string[];
};

const OVERLAY_ROLES = ["leadVocals", "backVocals"] as const;
type OverlayRole = (typeof OVERLAY_ROLES)[number];

/**
 * Co? Přepočte vokální overlays po výměně muzikantů na slotech lineupu.
 *
 * Pravidlo pro každou výměnu A → B, pro `leadVocals` i `backVocals` zvlášť:
 * - A v roli byl → vždy se odebere,
 * - B umí zpívat → nastoupí na pozici, kterou A držel,
 * - B neumí zpívat (nebo je slot prázdný) → jen se odebere A,
 * - A v roli nebyl → role se nemění, B se nepřidává.
 *
 * Pozice v poli je významná (pořadí vokálů na PDF), proto náhrada dědí index,
 * ne konec pole.
 *
 * Čistá funkce: žádné I/O, capability přichází jako injektovaný predikát, aby
 * doména nemusela znát katalog presetů ani `packages/desktop`.
 *
 * Vztah k invariantům: dvojroli lead+back tady neřešíme. Zůstává na
 * `enforceVocalSelectionInvariant`, který je jediný zdroj pravdy o tom, že
 * lead vokalista nemůže být zároveň back — tady by druhá kontrola dala druhé
 * pravidlo. Volající pouští invariant nad výsledkem téhle funkce.
 */
export function reconcileOverlaysAfterLineupChange<
  TOverlays extends ReconcilableOverlays,
>(args: {
  overlays: TOverlays;
  slotChanges: readonly LineupSlotChange[];
  canSing: (musicianId: string) => boolean;
}): TOverlays {
  const effectiveChanges = args.slotChanges.filter(
    (change) =>
      change.previousMusicianId.trim().length > 0 &&
      change.previousMusicianId !== change.nextMusicianId,
  );
  if (effectiveChanges.length === 0) return args.overlays;

  let next = args.overlays;
  for (const role of OVERLAY_ROLES) {
    const current = args.overlays[role];
    if (!current) continue;
    const reconciled = reconcileRole(current, effectiveChanges, args.canSing);
    if (reconciled === current) continue;
    next = { ...next, [role]: reconciled };
  }
  return next;
}

function reconcileRole(
  current: readonly string[],
  slotChanges: readonly LineupSlotChange[],
  canSing: (musicianId: string) => boolean,
): readonly string[] {
  const replacementByPrevious = new Map<string, string>();
  for (const change of slotChanges) {
    replacementByPrevious.set(change.previousMusicianId, change.nextMusicianId);
  }

  let changed = false;
  const seen = new Set<string>();
  const next: string[] = [];
  for (const musicianId of current) {
    if (!replacementByPrevious.has(musicianId)) {
      if (seen.has(musicianId)) {
        changed = true;
        continue;
      }
      seen.add(musicianId);
      next.push(musicianId);
      continue;
    }

    changed = true;
    const replacementId = replacementByPrevious.get(musicianId) ?? "";
    if (!replacementId || !canSing(replacementId)) continue;
    if (seen.has(replacementId)) continue;
    seen.add(replacementId);
    next.push(replacementId);
  }

  return changed ? next : current;
}
