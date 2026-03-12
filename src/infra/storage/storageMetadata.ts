import fs from "node:fs/promises";
import { catalogPaths } from "./catalogPaths.js";

export type StorageMetadata = {
  schemaVersion: number;
  seedVersion: number;
  seedCompleted: boolean;
  createdAt: string;
  lastMigratedAt?: string;
};

export async function readStorageMetadata(root?: string): Promise<StorageMetadata> {
  const file = catalogPaths(root).storageMeta;
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as StorageMetadata;
}
