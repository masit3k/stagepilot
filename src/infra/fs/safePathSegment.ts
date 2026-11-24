/**
 * Co? Kontrola jednoho segmentu cesty (jméno složky nebo souboru), než jde do
 * `path.join`.
 * Proč? Id projektu, verze a kontaktu i název PDF pocházejí z JSON souborů,
 * které může upravit kdokoli. `..\..\evil` by vedlo mimo kořen uživatelských
 * dat a `AC/DC` by tiše založilo podsložku. Pravidla jsou ta přísnější
 * (Windows), aby data byla přenosná mezi systémy.
 */

// Oddělovače cesty, znaky zakázané ve Windows názvu a řídicí znaky.
// biome-ignore lint/suspicious/noControlCharactersInRegex: řídicí znaky jsou přesně to, co se tu odmítá
const FORBIDDEN_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: řídicí znaky jsou přesně to, co se tu nahrazuje
const FORBIDDEN_CHARS_GLOBAL = /[<>:"/\\|?*\u0000-\u001f]/g;

const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Windows považuje za zařízení i `NUL.txt`: rozhoduje část před první tečkou. */
function isReservedName(segment: string): boolean {
  const stem = segment.split(".")[0].trimEnd();
  return RESERVED_NAMES.test(stem);
}

function describeProblem(segment: string): string | null {
  if (segment.length === 0) return "is empty";
  if (FORBIDDEN_CHARS.test(segment)) {
    return "contains a path separator or a character not allowed in a file name";
  }
  if (segment === "." || segment.includes("..")) {
    return "contains a relative path reference";
  }
  if (/[. ]$/.test(segment)) return "ends with a dot or a space";
  if (isReservedName(segment)) return "is a reserved device name";
  return null;
}

/**
 * Vrátí `value` beze změny, nebo vyhodí chybu se jménem pole. Nic neopravuje:
 * id je identita a potichu upravené id by ukázalo na jiný záznam.
 */
export function assertSafePathSegment(
  value: string,
  fieldName: string,
): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${fieldName}: expected a string.`);
  }
  const problem = describeProblem(value);
  if (problem) {
    throw new Error(
      `Invalid ${fieldName} ${JSON.stringify(value)}: ${problem}.`,
    );
  }
  return value;
}

/**
 * Název souboru odvozený z lidského textu (slug projektu). Na rozdíl od id se
 * opravuje: nepovolené znaky nahradí `_`, aby se soubor dál vytvořil, jen pod
 * bezpečným jménem. Bezpečný název vrací beze změny.
 */
export function toSafeFileName(value: string): string {
  let name = value
    .replace(FORBIDDEN_CHARS_GLOBAL, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/[. ]+$/, "_");
  if (name.length === 0) return "_";
  if (isReservedName(name)) name = `_${name}`;
  return name;
}
