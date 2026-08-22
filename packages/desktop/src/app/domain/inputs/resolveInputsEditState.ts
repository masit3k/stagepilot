import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  PresetEntity,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import type { EventSetupEditState } from "../../components/setup/adapters/eventSetupAdapter";
import type { BandSetupData } from "../../shell/types";
import { resolveSetupForSlot } from "../setup/resolveSetupForSlot";

/**
 * Co? Vstupní stav pro `SchemaRenderer` a katalogy polí jednoho slotu lineupu
 * — nepatchovaný default vedle efektivního presetu a patch, který je spojuje.
 *
 * Proč tady? Dodnes to byl inline výraz uvnitř JSX modálu na obrazovce `01`
 * (`ProjectSetupPage.tsx:1929-1961`) a nikdy neměl test. Modál se v F5d
 * stěhuje na `02` a v kroku D mizí; kdyby logika zůstala v komponentě, smazal
 * by ji krok D bez sítě. `ProjectSetupPage.tsx` ani `ProjectInputsPage.tsx`
 * vlastní test nemají, takže tohle je jediné místo, kde se dá hlídat.
 *
 * Jediný zdroj pravdy je `resolveSetupForSlot`, tedy totéž, z čeho čte
 * inspektor i tabulka řádků. Kdyby modál počítal default sám, editoval by
 * preset, který zbytek obrazovky neukazuje.
 *
 * `EventSetupEditState` je `import type` z komponentové vrstvy schválně: typ
 * se při buildu maže, runtime závislost `app/domain` → `app/components`
 * nevzniká, a duplikát v doméně by se s originálem časem rozešel.
 */
export function resolveInputsEditState(args: {
  role: Group;
  musicianId: string;
  patch: PresetOverridePatch | undefined;
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}): EventSetupEditState {
  const { resolved, effective } = resolveSetupForSlot({
    role: args.role,
    musicianId: args.musicianId,
    patch: args.patch,
    setupData: args.setupData,
    presetCatalog: args.presetCatalog,
  });

  return {
    defaultPreset: resolved.defaultPreset,
    effectivePreset: effective,
    ...(args.patch ? { patch: args.patch } : {}),
  };
}
