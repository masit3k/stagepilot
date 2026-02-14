import path from "node:path";

import type { Group } from "../../domain/model/groups.js";
import { DATA_ROOT } from "./dataRoot.js";

function getAssetsRoot(dataRoot: string = DATA_ROOT): string {
  return path.join(dataRoot, "assets");
}

export function getCatalogPath(group: Group, dataRoot: string = DATA_ROOT): string {
  return path.join(getAssetsRoot(dataRoot), "catalog", "inputs", `${group}.json`);
}

export function getGroupPresetsDir(group: Group, dataRoot: string = DATA_ROOT): string {
  return path.join(getAssetsRoot(dataRoot), "presets", "groups", group);
}

export function getAllGroupPresetsDir(dataRoot: string = DATA_ROOT): string {
  return path.join(getAssetsRoot(dataRoot), "presets", "groups");
}

export function getMonitorPresetsDir(dataRoot: string = DATA_ROOT): string {
  return path.join(getAssetsRoot(dataRoot), "presets", "monitors");
}

export function getTemplatesDir(dataRoot: string = DATA_ROOT): string {
  return path.join(getAssetsRoot(dataRoot), "templates");
}

export function getNotesTemplatesDir(dataRoot: string = DATA_ROOT): string {
  return path.join(getTemplatesDir(dataRoot), "notes");
}
