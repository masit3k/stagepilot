import { resolveStereoPair } from "../formatters/index.js";

type StereoSortable = {
  key: string;
  label: string;
  group: string;
  note?: string;
};

/**
 * Co? Přerovná vypočtené pořadí kanálů podle ručního pořadí uloženého
 * na projektu (R8).
 *
 * Proč tak? Ruční pořadí musí přežít změnu lineupu. Kanál, který uživatel
 * nikdy neviděl, proto nepadá na konec seznamu, ale vkládá se tam, kam ho
 * dal výpočet — za posledního známého předchůdce. Zmizelé klíče se tiše
 * ignorují, protože lineup se mění častěji než pořadí.
 *
 * Pořadí je čistá funkce nad klíči. Volá se mezi `composeFinalPdfInputOrder`
 * a `assignPdfChannels`, tedy až po `disambiguateInputKeys`, kde jsou klíče
 * unikátní.
 */
export function applyManualInputOrder<T extends StereoSortable>(
  computed: readonly T[],
  manualOrder: readonly string[] | undefined,
): T[] {
  if (!manualOrder || manualOrder.length === 0) return [...computed];

  const byKey = new Map<string, T>();
  for (const row of computed) {
    if (!byKey.has(row.key)) byKey.set(row.key, row);
  }

  // Pravidlo 1: základ je ruční pořadí profiltrované na existující klíče,
  // bez duplikátů.
  const placed = new Set<string>();
  const result: T[] = [];
  for (const key of manualOrder) {
    const row = byKey.get(key);
    if (!row || placed.has(key)) continue;
    placed.add(key);
    result.push(row);
  }

  // Pravidla 2 a 3: klíč, který v ručním pořadí není, se vloží za posledního
  // známého předchůdce z vypočteného pořadí; bez předchůdce jde na začátek.
  let anchorKey: string | null = null;
  for (const row of computed) {
    if (placed.has(row.key)) {
      anchorKey = row.key;
      continue;
    }

    const at =
      anchorKey === null
        ? 0
        : result.findIndex((entry) => entry.key === anchorKey) + 1;
    result.splice(at, 0, row);
    placed.add(row.key);
    anchorKey = row.key;
  }

  return rejoinStereoPairs(result);
}

/**
 * Vrátí `R` vedle jeho `L` (R9). `assignPdfChannels` páruje jen sousedy,
 * takže rozdělený pár by se tiskl jako dva samostatné kanály a ztratil by
 * zarovnání na nepatrné číslo.
 *
 * Kritérium páru je `resolveStereoPair`, tedy přesně to, které používá
 * číslování. Dvě položky, které jen vypadají jako pár (jiná skupina, jiná
 * poznámka), se nespojí.
 */
function rejoinStereoPairs<T extends StereoSortable>(rows: T[]): T[] {
  const out = [...rows];

  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    if (out[i + 1] && resolveStereoPair(a, out[i + 1])) {
      i++;
      continue;
    }

    const partnerAt = out.findIndex(
      (candidate, index) => index > i + 1 && resolveStereoPair(a, candidate),
    );
    if (partnerAt === -1) continue;

    const [partner] = out.splice(partnerAt, 1);
    out.splice(i + 1, 0, partner);
    i++;
  }

  return out;
}
