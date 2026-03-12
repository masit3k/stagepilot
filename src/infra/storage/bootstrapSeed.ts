import fs from "node:fs/promises";
import path from "node:path";
import { catalogPaths } from "./catalogPaths.js";

async function copyJsonTreeIfMissing(from: string, to: string): Promise<void> {
  const entries = await fs.readdir(from, { withFileTypes: true });
  await fs.mkdir(to, { recursive: true });
  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyJsonTreeIfMissing(src, dst);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      await fs.access(dst).catch(async () => fs.copyFile(src, dst));
    }
  }
}

export async function bootstrapSeed({ root, seedRoot }: { root: string; seedRoot: string }) {
  const p = catalogPaths(root);
  await fs.mkdir(p.projects, { recursive: true });
  await fs.mkdir(p.exports, { recursive: true });
  await fs.mkdir(p.temp, { recursive: true });
  await fs.mkdir(p.versions, { recursive: true });
  await copyJsonTreeIfMissing(path.join(seedRoot, "bands"), p.bands);
  await copyJsonTreeIfMissing(path.join(seedRoot, "musicians"), p.musicians);
  await copyJsonTreeIfMissing(path.join(seedRoot, "contacts"), p.contacts);
  await copyJsonTreeIfMissing(path.join(seedRoot, "assets", "presets", "groups"), p.presetsGroups);
  await copyJsonTreeIfMissing(path.join(seedRoot, "assets", "presets", "monitors"), p.presetsMonitors);
  await copyJsonTreeIfMissing(path.join(seedRoot, "assets", "templates", "notes"), p.templatesNotes);
}
