// Co? Pravidlo pro id odvozené z lidského názvu (R4 specu editoru kapely).
// Proč v doméně? Id vzniká v UI, ale musí sedět s tím, co čte pipeline
// (`catalogRepository`) a co Rust pustí do jména souboru
// (`sanitize_id_to_filename`). Jedno pravidlo, jedno místo.

// `\p{M}` = všechny kombinující znaky. Rozsah `[̀-ͯ]` by Biome
// odmítl pravidlem `lint/suspicious/noMisleadingCharacterClass` (ověřeno).
const COMBINING_MARKS = /\p{M}/gu;

export const ID_SLUG_MAX_LENGTH = 50;

/** `Blanická` → `Blanicka`: rozklad na NFD a zahození kombinující diakritiky. */
export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "");
}

/**
 * Malá písmena, bez diakritiky, běhy nealfanumerických znaků na `_`,
 * oříznutá podtržítka, nejvýš 50 znaků. Podtržítko, které vznikne řezem
 * na 50 znaků, se ořízne taky, aby id nekončilo `_`.
 */
export function toIdSlug(value: string): string {
  return stripDiacritics(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, ID_SLUG_MAX_LENGTH)
    .replace(/_+$/g, "");
}
