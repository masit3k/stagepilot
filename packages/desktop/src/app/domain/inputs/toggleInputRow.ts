import type {
  InputChannel,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { finalizePatchInputs } from "./finalizePatchInputs";

/**
 * Zapíše `add`/`remove`/`removeKeys` v patchi — prázdný seznam pole vynechá,
 * aby uložený projekt nenesl šum. `replace`/`update` nechává beze změny,
 * odsud se nikdy nepíší. Rozepsáno pole po poli (místo generické smyčky přes
 * klíč) a bez mutace vstupu, protože `PresetOverridePatch["inputs"]` má pro
 * každé pole jiný typ prvku (`InputChannel[]` vs. `string[]`) — přiřazení
 * přes společný klíč nebo mazání přes `delete` by tu vyžadovalo `as`, kterým
 * se tenhle projekt vyhýbá.
 */
function withInputs(
  patch: PresetOverridePatch | undefined,
  next: { add?: InputChannel[]; remove?: string[]; removeKeys?: string[] },
): PresetOverridePatch {
  const current = patch?.inputs ?? {};
  const add = next.add ?? current.add ?? [];
  const remove = next.remove ?? current.remove ?? [];
  const removeKeys = next.removeKeys ?? current.removeKeys ?? [];

  const inputs: NonNullable<PresetOverridePatch["inputs"]> = {
    ...(current.replace !== undefined ? { replace: current.replace } : {}),
    ...(current.update !== undefined ? { update: current.update } : {}),
    ...(add.length > 0 ? { add } : {}),
    ...(remove.length > 0 ? { remove } : {}),
    ...(removeKeys.length > 0 ? { removeKeys } : {}),
  };

  return finalizePatchInputs(patch, inputs);
}

/**
 * Vypnutí kanálu.
 *
 * Kanál, který do projektu přidal uživatel, se **maže ze `add`** a nedává se
 * do `remove`. `remove` je odchylka proti výchozím presetům muzikanta, a
 * kanál, který ve výchozích presetech nikdy nebyl, se odebráním jen vrací do
 * původního stavu — zapsat ho do `remove` by nechalo v projektu odchylku,
 * která nic nemění.
 *
 * Duplicitu kontroluje proti sjednocení `remove` i legacy `removeKeys` —
 * kanál vypnutý na obrazovce `01` (`buildInputsPatchFromTarget` v
 * `pages/shared/setupConstants.ts`) zapisuje do `removeKeys`, ne do `remove`,
 * a doména je při čtení stejně slučuje (`applyPresetOverride`). Bez téhle
 * kontroly by šlo stejný kanál zapsat do `remove` podruhé, i když je díky
 * `removeKeys` už vypnutý.
 */
export function removeInputRow(
  patch: PresetOverridePatch | undefined,
  key: string,
): PresetOverridePatch {
  const added = patch?.inputs?.add ?? [];
  if (added.some((input) => input.key === key)) {
    return withInputs(patch, {
      add: added.filter((input) => input.key !== key),
    });
  }

  const remove = patch?.inputs?.remove ?? [];
  const removeKeys = patch?.inputs?.removeKeys ?? [];
  if (remove.includes(key) || removeKeys.includes(key)) return patch ?? {};
  return withInputs(patch, { remove: [...remove, key] });
}

/**
 * Vrácení vypnutého kanálu. Filtruje klíč z **obou** odebíracích polí —
 * `remove` i legacy `removeKeys` — protože kanál vypnutý na obrazovce `01`
 * zapisuje do `removeKeys`. Bez tohohle by šlo z obrazovky `02` vrátit jen
 * kanál vypnutý odsud, ne kanál vypnutý na `01`.
 */
export function restoreInputRow(
  patch: PresetOverridePatch | undefined,
  key: string,
): PresetOverridePatch {
  return withInputs(patch, {
    remove: (patch?.inputs?.remove ?? []).filter((entry) => entry !== key),
    removeKeys: (patch?.inputs?.removeKeys ?? []).filter(
      (entry) => entry !== key,
    ),
  });
}

export function addInputRow(
  patch: PresetOverridePatch | undefined,
  input: InputChannel,
): PresetOverridePatch {
  const add = patch?.inputs?.add ?? [];
  if (add.some((entry) => entry.key === input.key)) return patch ?? {};
  return withInputs(patch, { add: [...add, input] });
}
