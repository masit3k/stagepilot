import { useCallback } from "react";
import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  PresetEntity,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import type { BandSetupData } from "../../shell/types";
import {
  resolveMusicianDefaultPreset,
  resolveSetupForSlot,
} from "./resolveSetupForSlot";

/**
 * Tenký obal nad čistými funkcemi — drží jen memoizaci. Veškerá logika je
 * v `resolveSetupForSlot.ts`, aby byla testovatelná bez Reactu (R16).
 */
export function useSetupOverrides(args: {
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}) {
  const { setupData, presetCatalog } = args;

  const defaultPresetFor = useCallback(
    (role: Group, musicianId: string) =>
      resolveMusicianDefaultPreset({
        role,
        musicianId,
        setupData,
        presetCatalog,
      }),
    [setupData, presetCatalog],
  );

  const setupForSlot = useCallback(
    (role: Group, musicianId: string, patch?: PresetOverridePatch) =>
      resolveSetupForSlot({
        role,
        musicianId,
        patch,
        setupData,
        presetCatalog,
      }),
    [setupData, presetCatalog],
  );

  return { defaultPresetFor, setupForSlot };
}
