// Co? Rekurzivně prochází adresář a vrací cesty ke všem .json souborům.
// Proč? Data jsou uložena v podsložkách a repo je musí načíst automaticky.

import fs from "node:fs/promises";
import path from "node:path";

export async function listJsonFiles(dir: string): Promise<string[]> {
  const result: string[] = [];

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await listJsonFiles(fullPath);
      result.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      result.push(fullPath);
    }
  }

  return result;
}
