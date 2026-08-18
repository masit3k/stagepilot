import type { PresetOverridePatch } from "../../../../../../src/domain/model/types";

/**
 * Sdílený konec všech čistých patch funkcí nad `presetOverride.inputs`
 * (`updateInputRow`, `toggleInputRow`). Prázdné `inputs` se z patche
 * vyhazují, aby uložený projekt nenesl šum — a `inputs: undefined` musí být
 * zapsáno explicitně, ne jen vynecháno, protože `{...patch}` by jinak
 * protáhl starou hodnotu dál.
 */
export function finalizePatchInputs(
  patch: PresetOverridePatch | undefined,
  inputs: NonNullable<PresetOverridePatch["inputs"]>,
): PresetOverridePatch {
  const hasInputs = Object.keys(inputs).length > 0;
  return {
    ...patch,
    ...(hasInputs ? { inputs } : {}),
    ...(hasInputs ? {} : { inputs: undefined }),
  };
}
