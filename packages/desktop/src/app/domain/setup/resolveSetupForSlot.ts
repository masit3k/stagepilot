import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  MusicianSetupPreset,
  PresetEntity,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { resolveEffectiveMusicianSetup } from "../../../../../../src/domain/setup/resolveEffectiveMusicianSetup";
import {
  getGroupDefaultPreset,
  resolveMusicianDefaultSetupForRole,
} from "../../pages/shared/setupConstants";
import type { BandSetupData } from "../../shell/types";
import { musicianDefaultsKey } from "./musicianDefaultsKey";

/**
 * Co? Rozlišení výchozího a efektivního setupu jednoho slotu lineupu.
 *
 * Proč tady? Obrazovky `01` a `02` obě potřebují totéž — `01` kvůli validaci
 * lineupu, `02` kvůli editaci kanálů. Logika je čistá, takže nesedí v žádné
 * z těch dvou komponent, a hlavně: `ProjectSetupPage.tsx` nemá vlastní test,
 * takže tohle je jediné místo, kde se dá tato logika hlídat (R16).
 */
export function resolveMusicianDefaultPreset(args: {
  role: Group;
  musicianId: string;
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}): MusicianSetupPreset {
  const { role, musicianId, setupData, presetCatalog } = args;
  const roleScopedDefaults =
    setupData?.musicianDefaults?.[musicianDefaultsKey(musicianId, role)];
  const genericDefaults = setupData?.musicianDefaults?.[musicianId];
  return resolveMusicianDefaultSetupForRole({
    role,
    musicianDefaults: genericDefaults,
    roleScopedDefaults,
    presetItems: setupData?.musicianPresetsById?.[musicianId],
    presetCatalog,
    bandDefaults: getGroupDefaultPreset(role, presetCatalog),
  });
}

export function resolveSetupForSlot(args: {
  role: Group;
  musicianId: string;
  patch?: PresetOverridePatch;
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
}) {
  const { role, musicianId, patch, setupData, presetCatalog } = args;
  const musicianDefaults = resolveMusicianDefaultPreset({
    role,
    musicianId,
    setupData,
    presetCatalog,
  });
  const resolved = resolveEffectiveMusicianSetup({
    musicianDefaults,
    bandDefaults: getGroupDefaultPreset(role, presetCatalog),
    eventOverride: patch,
    group: role,
  });

  return {
    resolved,
    effective: {
      inputs: resolved.effectiveInputs,
      monitoring: resolved.effectiveMonitoring,
    },
  };
}
