import { resolveEffectiveInstrumentGroups } from "../../../../../../src/domain/lineup/effectiveInstrumentGroups";
import {
  type SetupCapabilitySection,
  resolveInputsForCapabilitySection,
} from "../../../../../../src/domain/lineup/resolveLineupInstrumentMembership";
import type { Group } from "../../../../../../src/domain/model/groups";
import type { InputChannel } from "../../../../../../src/domain/model/types";

export type InputsFieldCatalogId = "bass" | "guitar" | "keys" | "lead_vocs";

export type InputsFieldSection = {
  /** React key; zároveň řez z `resolveEffectiveInstrumentGroups`. */
  readonly key: string;
  /** Prázdný řetězec znamená jedinou sekci — nadpis je pak jen „Inputs". */
  readonly label: string;
  readonly catalog: InputsFieldCatalogId;
};

/**
 * Role, kterým se modál `Edit inputs` nabízí (F5d R4, OQ-1).
 *
 * `drums` chybí: bicí kanály staví `drumDefinition` a mění se přes `Edit kit`.
 * `vocs` a `talkback` chybí taky, a je to měřený závěr, ne opomenutí — vokální
 * preset se do `document.inputs` nikdy nedostane (`buildMusicianInstrumentInputs`
 * ho odloží jako `vocalCapability`), tištěný řádek má klíč `voc_lead_{slot}` a
 * staví se z nepatchovaných presetů muzikanta, takže by dropdown typu
 * mikrofonu změnil UI-preview a v PDF nic. Přidání a odebrání vokálního řádku
 * řídí overlays (R7, vlna 2), ne tenhle modál.
 */
export const INPUTS_MODAL_ROLES: readonly Group[] = ["bass", "guitar", "keys"];

export function supportsInputsModal(role: Group): boolean {
  return INPUTS_MODAL_ROLES.includes(role);
}

function catalogForSliceKey(sliceKey: string): InputsFieldCatalogId {
  if (sliceKey === "keys") return "keys";
  if (sliceKey === "electric_guitar" || sliceKey === "acoustic_guitar")
    return "guitar";
  return "lead_vocs";
}

/**
 * Co? Na kolik sekcí se modál `Edit inputs` rozpadne a který katalog polí
 * dostane každá z nich.
 *
 * Dvě věci, které to spojuje, dnes leží inline v JSX modálu na obrazovce `01`
 * (`ProjectSetupPage.tsx:1944-1964` a `:2280-2287`) a nikdy neměly test.
 * Kontraktní test 7 z R8 přitom požaduje aserci „klávesista s mono presetem
 * dostane KEYS_FIELDS, ne LEAD_VOCS_FIELDS", a tu nad komponentou bez jsdom
 * napsat nejde.
 *
 * Sériové zapojení obou prefixových kopií (M4): `resolveInputsForCapabilitySection`
 * (kopie 1) filtruje kanály na řez role, `resolveEffectiveInstrumentGroups`
 * (kopie 2) je rozdělí na podřezy. Co odfiltruje první, druhá už neuvidí —
 * proto je krok A srovnal dřív, než se to sem přestěhovalo.
 *
 * Bass jde mimo rozdělení, jednou nedělenou sekcí, přesně jako dnes na `01`:
 * `buildBassFields` si výběr zapojení řeší samo přes `setupGroup`/`presetRole`.
 *
 * Prázdný výsledek dá shim `{ key: "vocs", catalog: "lead_vocs" }` — dnešní
 * chování zachované beze změny. Krok A zavřel jedinou cestu, po které se tam
 * chodilo omylem; zbytek je otevřená otázka OQ-2 pro navazující fázi.
 *
 * Nadpis skládá komponenta: jedna sekce → `Input`, víc sekcí → `Input – {label}`.
 * Funkce vrací jen `label`.
 */
export function resolveInputsFieldSections(args: {
  role: Group;
  effectiveInputs: InputChannel[];
}): InputsFieldSection[] {
  if (!supportsInputsModal(args.role)) return [];
  if (args.role === "bass")
    return [{ key: "bass", label: "", catalog: "bass" }];

  // `as` je tu bezpečné: `supportsInputsModal` odfiltroval `drums`, `vocs`
  // i `talkback` a `bass` se vrátil o řádek dřív, takže sem dojdou jen
  // `guitar` a `keys` — obě jsou v `SetupCapabilitySection` doslova.
  const section = args.role as SetupCapabilitySection;
  const sectionInputs = resolveInputsForCapabilitySection({
    section,
    inputs: args.effectiveInputs,
  });
  const slices = resolveEffectiveInstrumentGroups(sectionInputs);

  if (slices.length === 0)
    return [{ key: "vocs", label: "", catalog: "lead_vocs" }];

  return slices.map((slice) => ({
    key: slice.key,
    label: slice.label,
    catalog: catalogForSliceKey(slice.key),
  }));
}
