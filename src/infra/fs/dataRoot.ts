// Co? Určuje absolutní cestu ke složce /data.
// Proč? Zajišťuje správné načítání dat bez ohledu na cwd.

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = process.cwd();
export const DATA_ROOT = path.resolve(PROJECT_ROOT, "data");
export const USER_DATA_ROOT = path.resolve(PROJECT_ROOT, "user_data");
