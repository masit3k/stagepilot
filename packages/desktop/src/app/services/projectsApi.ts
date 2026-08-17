import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "./tauriCommands";
import { type SaveIntent, stampProjectUpdate } from "../domain/project/stampProjectUpdate";
import type { BandOption, BandSetupData, NewProjectPayload, ProjectSummary } from "../shell/types";
import { toPersistableProject } from "../shell/types";
import type { MusicianSetupPreset } from "../../../../../src/domain/model/types";

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

/**
 * Co? Jediná cesta, kterou se projekt zapisuje na disk.
 * Proč? Razítko se nesmí dát obejít ani zapomenout.
 */
export function saveProjectPayload(args: {
  projectId: string;
  legacyProjectId?: string;
  payload: NewProjectPayload;
  intent: SaveIntent;
}) {
  const stamped = stampProjectUpdate(args.payload, args.intent, new Date().toISOString());
  return saveProject({
    projectId: args.projectId,
    ...(args.legacyProjectId ? { legacyProjectId: args.legacyProjectId } : {}),
    json: JSON.stringify(toPersistableProject(stamped), null, 2),
  });
}

export function deleteProjectPermanently(projectId: string) {
  return invoke<void>(TAURI_COMMANDS.DELETE_PROJECT_PERMANENTLY, { projectId });
}

export function getBandSetupData(bandId: string) {
  return invoke<BandSetupData>(TAURI_COMMANDS.GET_BAND_SETUP_DATA, { bandId });
}

/**
 * Co? Povýší dočasnou odchylku jednoho slotu na trvalý default muzikanta
 * (R5) — `setup` je efektivní preset slotu (`setupForSlot(...).effective`),
 * stejný tvar, jaký dřív posílal setup modál na obrazovce `01`.
 * Proč přes tuhle vrstvu? CLAUDE.md vyžaduje, aby desktop volal Tauri příkazy
 * přes `tauriCommands.ts` — přímé `invoke` v `ProjectSetupPage.tsx` je starý
 * kód, který zaniká s Taskem 19, tenhle je jeho náhrada pro obrazovku `02`.
 */
export function updateMusicianDefaults(args: {
  musicianId: string;
  role: string;
  setup: MusicianSetupPreset;
}) {
  return invoke<void>(TAURI_COMMANDS.UPDATE_MUSICIAN_DEFAULTS, args);
}

export function parseProjectPayload(raw: string): NewProjectPayload & Record<string, unknown> {
  return JSON.parse(raw) as NewProjectPayload & Record<string, unknown>;
}
