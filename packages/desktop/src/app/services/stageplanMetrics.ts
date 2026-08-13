import { invoke } from "@tauri-apps/api/core";
import type { StageplanPrintGeometry } from "../../../../../src/domain/stageplan/print/printMetrics";
import { TAURI_COMMANDS } from "./tauriCommands";

/** Stopa je pomůcka, ne podmínka editace — volající chybu jen zaloguje (R12). */
export function fetchStageplanPrintGeometry(projectId: string) {
  return invoke<StageplanPrintGeometry>(
    TAURI_COMMANDS.STAGEPLAN_PRINT_METRICS,
    { projectId },
  );
}
