import path from "node:path";
import { resolveStorageRoot } from "../storage/catalogPaths.js";

export const PROJECT_ROOT = process.cwd();
export const USER_DATA_ROOT = resolveStorageRoot();
export const SEED_DATA_ROOT = path.resolve(PROJECT_ROOT, "data");

export const DATA_ROOT = SEED_DATA_ROOT;
