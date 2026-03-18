import fs from "node:fs/promises";
import path from "node:path";

export async function listJsonFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return result;
    throw error;
  }
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
