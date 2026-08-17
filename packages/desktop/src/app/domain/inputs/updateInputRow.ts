import type {
  PartialInputUpdate,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";

/**
 * Co? Zapíše přejmenování nebo změnu poznámky jednoho kanálu do patche slotu.
 *
 * Proč tak málo kódu? Vrstva `inputs.update[]` v doméně existovala už před
 * touto fází a `applyPresetOverride` ji aplikuje — F5c dodává jen UI (R6).
 *
 * Vlastnost přítomná s hodnotou `undefined` znamená „zruš ji", vlastnost
 * chybějící znamená „nech ji být". Bez toho rozdílu by nešlo vrátit řádek
 * na původní znění, aniž by se smazala i poznámka.
 */
export function updateInputRow(
  patch: PresetOverridePatch | undefined,
  change: { key: string; label?: string; note?: string },
): PresetOverridePatch {
  const existing = patch?.inputs?.update ?? [];
  const current = existing.find((entry) => entry.key === change.key);

  const merged: PartialInputUpdate = { key: change.key };
  const label = "label" in change ? change.label : current?.label;
  const note = "note" in change ? change.note : current?.note;
  if (label !== undefined) merged.label = label;
  if (note !== undefined) merged.note = note;

  const changesSomething = Object.keys(merged).length > 1;
  const update = changesSomething
    ? current
      ? existing.map((entry) => (entry.key === change.key ? merged : entry))
      : [...existing, merged]
    : existing.filter((entry) => entry.key !== change.key);

  const { update: _previousUpdate, ...restInputs } = patch?.inputs ?? {};
  const inputs = update.length > 0 ? { ...restInputs, update } : restInputs;

  const hasInputs = Object.keys(inputs).length > 0;
  return {
    ...patch,
    ...(hasInputs ? { inputs } : {}),
    ...(hasInputs ? {} : { inputs: undefined }),
  };
}
