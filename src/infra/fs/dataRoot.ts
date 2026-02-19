import os from "node:os";
import path from "node:path";

export const PROJECT_ROOT = process.cwd();
export const DATA_ROOT = path.resolve(PROJECT_ROOT, "data");
const TAURI_APP_ID =
  process.env.STAGEPILOT_TAURI_APP_ID || "com.mkrecmer.stagepilot-desktop";

function resolveAppDataBaseDir(): string {
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support");
  }
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
}

export const USER_DATA_ROOT = path.join(
  resolveAppDataBaseDir(),
  TAURI_APP_ID,
  "stagepilot",
);
