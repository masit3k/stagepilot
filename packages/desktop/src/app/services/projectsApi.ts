import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "./tauriCommands";
import type { BandOption, BandSetupData, NewProjectPayload, ProjectSummary } from "../shell/types";

export function listBands() {
  return invoke<BandOption[]>(TAURI_COMMANDS.LIST_BANDS);
}

export function listProjects() {
  return invoke<ProjectSummary[]>(TAURI_COMMANDS.LIST_PROJECTS);
}

export function readProject(projectId: string) {
  return invoke<string>(TAURI_COMMANDS.READ_PROJECT, { projectId });
}

export function saveProject(args: { projectId: string; legacyProjectId?: string; json: string }) {
  return invoke<void>(TAURI_COMMANDS.SAVE_PROJECT, args);
}

export function deleteProjectPermanently(projectId: string) {
  return invoke<void>(TAURI_COMMANDS.DELETE_PROJECT_PERMANENTLY, { projectId });
}

export function getBandSetupData(bandId: string) {
  return invoke<BandSetupData>(TAURI_COMMANDS.GET_BAND_SETUP_DATA, { bandId });
}

export function parseProjectPayload(raw: string): NewProjectPayload & Record<string, unknown> {
  return JSON.parse(raw) as NewProjectPayload & Record<string, unknown>;
}
