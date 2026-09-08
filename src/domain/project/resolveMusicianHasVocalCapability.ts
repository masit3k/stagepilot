import { resolvePresetIdAlias } from "../model/presetAliases.js";
import type { Musician, PresetEntity } from "../model/types.js";

/**
 * Umí muzikant zpívat? Capability není inline na muzikantovi — sedí na presetu
 * v katalogu (`vocal_no_mic`, `vocal_wired`, `vocal_wireless` nesou
 * `capabilities: ["vocal"]`), takže se musí dohledat přes `presets[].ref`.
 *
 * Proč v doméně? Řídí dvě věci naráz: sekci `suggested` ve vokálních modálech
 * (`packages/desktop/.../resolveLineupVocalCandidates`) a automatickou derivaci
 * overlays po změně lineupu (`reconcileOverlaysAfterLineupChange`). Druhá kopie
 * by dala dva zdroje pravdy o tom, kdo zpívá.
 *
 * Pozor: capability řídí jen tuhle automatiku a rozdělení `suggested` vs
 * `other_lineup_members`, NE dostupnost ve výběru. Bez capability je člen
 * lineupu pořád vybratelný ručně.
 */
export function resolveMusicianHasVocalCapability(
  musician: Musician,
  presetCatalog: Record<string, PresetEntity | undefined>,
): boolean {
  for (const item of musician.presets) {
    if (item.kind !== "preset") continue;
    const preset = presetCatalog[resolvePresetIdAlias(item.ref)];
    if (!preset || preset.type !== "preset") continue;
    if (preset.capabilities?.includes("vocal")) return true;
  }
  return false;
}
