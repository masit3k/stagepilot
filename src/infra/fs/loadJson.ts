// Co? Načítá a parsuje JSON soubor.
// Proč? Centralizuje práci s JSONem a error handling.

import fs from "node:fs/promises";

export async function loadJsonFile<T>(path: string): Promise<T> {
  const raw = await fs.readFile(path, "utf8");
  return JSON.parse(raw) as T;
}
