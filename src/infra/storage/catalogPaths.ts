import os from "node:os";
import path from "node:path";

const USER_DATA_DIR_NAME = "StagePilot";

function resolveAppDataBaseDir(): string {
  if (process.platform === "win32")
    return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  if (process.platform === "darwin")
    return path.join(os.homedir(), "Library", "Application Support");
  return (
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
  );
}

export function resolveStorageRoot(): string {
  return path.join(resolveAppDataBaseDir(), USER_DATA_DIR_NAME);
}

export function catalogPathsForRoot(root: string) {
  return {
    root,
    projects: path.join(root, "projects"),
    exports: path.join(root, "exports"),
    temp: path.join(root, "temp"),
    versions: path.join(root, "versions"),
    bands: path.join(root, "catalog", "bands"),
    musicians: path.join(root, "catalog", "musicians"),
    contacts: path.join(root, "catalog", "contacts"),
    presetsGroups: path.join(root, "catalog", "presets", "groups"),
    presetsMonitors: path.join(root, "catalog", "presets", "monitors"),
    templatesNotes: path.join(root, "catalog", "templates", "notes"),
    storageMeta: path.join(root, "storage.json"),
  };
}

export function catalogPaths(root = resolveStorageRoot()) {
  return catalogPathsForRoot(root);
}
