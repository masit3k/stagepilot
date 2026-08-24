import type {
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { normalizeSetupOverridePatch } from "../../../../../../src/domain/rules/presetOverride";
import {
  type DroppedUserEdit,
  resolveDroppedUserEdits,
} from "./resolveDroppedUserEdits";

/**
 * Co? Jestli se zamýšlený patch modálu `Edit inputs` uloží rovnou, nebo se má
 * nejdřív zaparkovat a nechat potvrdit, protože by zahodil uživatelovu úpravu.
 *
 * Proč čistá funkce, a ne větev v `InputsSetupSection`: je to netriviální
 * rozhodnutí a to podle Global Constraints plánu patří do
 * `app/domain/**`, ne do komponenty. Repozitář nemá jsdom (R8), takže větev
 * uvnitř komponenty se testem nedá dosáhnout vůbec — jediné, co ji krylo, byla
 * ruční interakce.
 *
 * Dvě věci, na kterých rozhodnutí stojí a které se z komponenty špatně vidí:
 *
 * - `normalizeSetupOverridePatch` je ta funkce, která z patche udělá
 *   `undefined`, jakmile se efektivní preset vrátí na default. Bez ní by
 *   v projektu zůstal patch, který nic nemění, a `DEVIATIONS N` by lhal.
 * - Parkovaný patch musí být ten **normalizovaný**, protože právě ten se po
 *   potvrzení uloží. Na seznam zahozených úprav to vliv nemá — měřeno mutací:
 *   `resolveDroppedUserEdits` si normalizaci dělá sám uvnitř
 *   `applyPresetOverride`, takže surový i normalizovaný patch dají tentýž
 *   seznam. Pořadí je tu kvůli čitelnosti, ne kvůli výsledku.
 */
export type InputsPatchCommit =
  | { kind: "commit"; patch: PresetOverridePatch | undefined }
  | {
      kind: "confirm";
      patch: PresetOverridePatch | undefined;
      dropped: DroppedUserEdit[];
    };

export function resolveInputsPatchCommit(args: {
  defaultPreset: MusicianSetupPreset;
  currentPatch: PresetOverridePatch | undefined;
  rawPatch: PresetOverridePatch | undefined;
}): InputsPatchCommit {
  const patch = normalizeSetupOverridePatch(args.defaultPreset, args.rawPatch);
  const dropped = resolveDroppedUserEdits({
    defaultPreset: args.defaultPreset,
    currentPatch: args.currentPatch,
    nextPatch: patch,
  });
  return dropped.length > 0
    ? { kind: "confirm", patch, dropped }
    : { kind: "commit", patch };
}
