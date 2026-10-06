import { stripDiacritics } from "../ids/slug.js";

// Co? Zkratka kapely (R5 specu editoru kapely).
// Proč tak přísně? Zkratka jde do názvu PDF (`formatProjectSlug`) a
// `catalogRepository` ji mapuje jako alias odkazu na kapelu
// (`code.toLowerCase()`), takže musí být krátká, ASCII a jednoznačná.

export const BAND_CODE_MAX_LENGTH = 6;

const SINGLE_WORD_CODE_LENGTH = 3;
const BAND_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;

/**
 * Víceslovný název → iniciály (nejvýš 6), jednoslovný → první tři znaky.
 * Výsledek nemusí být platný (název „A" dá `A`); o tom rozhoduje
 * `isValidBandCode` až při uložení.
 */
export function deriveBandCode(name: string): string {
  const words = stripDiacritics(name)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, SINGLE_WORD_CODE_LENGTH);
  return words
    .map((word) => word[0])
    .join("")
    .slice(0, BAND_CODE_MAX_LENGTH);
}

/** Ruční vstup → tvar, který se ukládá: velká písmena, bez diakritiky a mezer. */
export function normalizeBandCode(raw: string): string {
  return stripDiacritics(raw).toUpperCase().replace(/\s+/g, "");
}

export function isValidBandCode(code: string): boolean {
  return BAND_CODE_PATTERN.test(code);
}
