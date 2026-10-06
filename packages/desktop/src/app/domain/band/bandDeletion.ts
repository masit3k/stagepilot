// Co? Projekty, které brání smazání kapely (dodatek A3), v podobě, jakou vrací
// Rust příkaz `delete_band` v poli `projects` chyby `BAND_IN_USE`.
// Proč tady? Typ sdílí služba (`bandsApi.ts`) i dialog, a `app/domain` nesmí
// importovat ze `services/` (Ruling 13).

export type BandUsage =
  | {
      readonly kind: "usesBand";
      readonly file: string;
      readonly displayName: string | null;
      readonly status: string | null;
    }
  | {
      readonly kind: "unreadable";
      readonly file: string;
      readonly message: string;
    };

/** Přečte `projects` z chyby `delete_band`; položku bez jména souboru vynechá. */
export function parseBandUsages(value: unknown): BandUsage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    const usage = toBandUsage(entry);
    return usage ? [usage] : [];
  });
}

function readText(entry: object, key: string): string | null {
  const value: unknown = Reflect.get(entry, key);
  return typeof value === "string" ? value : null;
}

/** Neznámý `kind` se bere jako „projekt kapelu používá" — blokovat je bezpečnější. */
function toBandUsage(entry: unknown): BandUsage | null {
  if (typeof entry !== "object" || entry === null) return null;
  const file = readText(entry, "file");
  if (!file) return null;
  if (readText(entry, "kind") === "unreadable") {
    return {
      kind: "unreadable",
      file,
      message: readText(entry, "message") ?? "",
    };
  }
  return {
    kind: "usesBand",
    file,
    displayName: readText(entry, "displayName"),
    status: readText(entry, "status"),
  };
}

const STATUS_SUFFIX: Readonly<Record<string, string>> = {
  archived: " (archived)",
  trashed: " (in trash)",
};

/**
 * Ruling 10: řádek dialogu — název projektu (nebo jméno souboru) a stav,
 * protože archivovaný nebo smazaný projekt na úvodní obrazovce nevidět.
 */
export function describeBandUsage(usage: BandUsage): string {
  if (usage.kind === "unreadable") {
    return `${usage.file} — could not be checked (${usage.message})`;
  }
  const name = usage.displayName?.trim() || usage.file;
  const suffix = usage.status ? (STATUS_SUFFIX[usage.status] ?? "") : "";
  return `${name}${suffix}`;
}
