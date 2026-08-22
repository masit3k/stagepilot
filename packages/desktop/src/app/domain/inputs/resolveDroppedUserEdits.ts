import type {
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { applyPresetOverride } from "../../../../../../src/domain/rules/presetOverride";

export type DroppedUserEdit = {
  readonly key: string;
  /** Uživatelův vlastní popisek — podle něj kanál v potvrzení pozná. */
  readonly label: string;
  readonly note?: string;
};

/**
 * Co? Kanály nesoucí uživatelskou odchylku (`presetOverride.inputs.update` —
 * přejmenování nebo poznámka), které by zamýšlený patch z efektivní sady
 * odstranil.
 *
 * Proč? Přepnutí `Connection` je destruktivní přepis celé sady kanálů slotu a
 * to je správná sémantika (F5d R5): kytarista, který přepnul z mikrofonu na
 * DI, ten mikrofon na pódiu nemá. Nedestruktivní varianta byla zvážena a
 * zamítnuta — zavedla by do modelu třetí kategorii kanálů, kterou by musela
 * znát doména, `Reset to default`, `countOwnerDeviations`, řazení v PDF i
 * validace. Ale destruktivita musí být vidět **dopředu**, ne až v PDF, a to
 * je jediný účel téhle funkce.
 *
 * Vrací se **efektivní** podoba kanálu, ne ta z presetu: v potvrzení má stát
 * jméno, které tam uživatel napsal, jinak nepozná, o co přichází.
 *
 * Co funkce vědomě NEhlásí: `withInputsTarget` skládá `update` znovu z cílové
 * sady, takže přejmenování může zmizet i u kanálu, který přepnutí přežije
 * (`rebuild` bere `mainInputs` z presetu, ne z efektivních kanálů). To je jiná
 * vada a je mimo rozsah F5d — tady se hlásí výhradně kanály, které z efektivní
 * sady zmizely.
 *
 * `applyPresetOverride` se volá přímo, ne přes `getPatchedInputs`
 * z `eventSetupAdapter`: je to sice tentýž výpočet, ale leží v komponentové
 * vrstvě a `app/domain/` na ni ukazovat nesmí.
 */
export function resolveDroppedUserEdits(args: {
  defaultPreset: MusicianSetupPreset;
  currentPatch: PresetOverridePatch | undefined;
  nextPatch: PresetOverridePatch | undefined;
}): DroppedUserEdit[] {
  const editedKeys = new Set(
    (args.currentPatch?.inputs?.update ?? []).map((item) => item.key),
  );
  if (editedKeys.size === 0) return [];

  const before = applyPresetOverride(
    args.defaultPreset,
    args.currentPatch,
  ).inputs;
  const afterKeys = new Set(
    applyPresetOverride(args.defaultPreset, args.nextPatch).inputs.map(
      (item) => item.key,
    ),
  );

  return before
    .filter((input) => editedKeys.has(input.key) && !afterKeys.has(input.key))
    .map((input) => ({
      key: input.key,
      label: input.label,
      ...(input.note ? { note: input.note } : {}),
    }));
}
