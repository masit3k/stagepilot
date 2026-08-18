/**
 * Co? Přesune jeden klíč na nový index a vrátí nové pořadí pro
 * `project.inputOrder`.
 *
 * Stereo páry se tady **neřeší**. Adjacency hlídá doména v
 * `applyManualInputOrder` (R9), takže UI může uživatele nechat táhnout cokoli
 * a výsledek se srovná při sestavení dokumentu. Duplikovat to pravidlo tady
 * by znamenalo dvě místa, která se mohou rozejít.
 */
export function moveInputRow(
  keys: readonly string[],
  fromKey: string,
  toIndex: number,
): string[] {
  const from = keys.indexOf(fromKey);
  if (from === -1) return [...keys];

  const next = [...keys];
  next.splice(from, 1);

  const at = Math.min(Math.max(toIndex, 0), next.length);
  next.splice(at, 0, fromKey);
  return next;
}

/**
 * Minimální tvar řádku, který `resolveActiveDropIndex` potřebuje — jen
 * identitu (`key`) a stav. Stejný vzor jako `StereoSortable` v
 * `applyManualInputOrder.ts`: čistá funkce si nese vlastní úzké rozhraní
 * místo importu celého `InputEditorRow` z `buildInputEditorRows.ts`.
 */
export type DropTargetRow = {
  readonly key: string;
  readonly state: "active" | "removed" | "filler";
};

/**
 * Co? Přeloží klíč řádku, na který uživatel pustil tažení, na index v
 * seznamu **aktivních** klíčů — ten, co čeká `moveInputRow`.
 *
 * Proč? `project.inputOrder` se skládá jen z aktivních řádků (Task 14,
 * Ruling 1) — vypnutý řádek má klíč jmenného prostoru vlastníka
 * (`composeRemovedRowKey`), který doména nezná, a výplňový řádek vyrábí
 * `assignPdfChannels` znovu při každém sestavení dokumentu. Ani jeden proto
 * do pořadí nepatří. Vypnuté a výplňové řádky ale zůstávají platným drop
 * cílem (jen nejsou `draggable` jako zdroj) — pustí-li na ně uživatel
 * tažení, přesune se na pozici nejbližšího **následujícího** aktivního
 * řádku; když už žádný nenásleduje, na konec seznamu.
 */
export function resolveActiveDropIndex(
  rows: readonly DropTargetRow[],
  targetKey: string,
): number {
  const activeCountBefore = (limit: number) =>
    rows.slice(0, limit).filter((row) => row.state === "active").length;

  const targetIndex = rows.findIndex((row) => row.key === targetKey);
  if (targetIndex === -1) return activeCountBefore(rows.length);

  for (let i = targetIndex; i < rows.length; i++) {
    if (rows[i].state === "active") return activeCountBefore(i);
  }
  return activeCountBefore(rows.length);
}
