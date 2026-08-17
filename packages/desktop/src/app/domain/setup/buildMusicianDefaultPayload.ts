import type { Group } from "../../../../../../src/domain/model/groups";
import type { MusicianSetupPreset } from "../../../../../../src/domain/model/types";

/**
 * Co? Argument object pro `updateMusicianDefaults` (Tauri příkaz
 * `update_musician_defaults`) — `setup` musí být vlastníkův **efektivní**
 * preset slotu (výsledek `setupForSlot(...).effective`), nikdy jeho syrový
 * `presetOverride` patch (`PresetOverridePatch`). Funkce patch vůbec
 * nepřijímá, takže tuhle záměnu nejde udělat omylem — a je to jediné místo,
 * které jde otestovat přímo, bez `ProjectInputsPage.tsx` a bez Reactu (R5,
 * Task 12b fix round 1).
 */
export function buildMusicianDefaultPayload(args: {
  ownerMusicianId: string;
  ownerRole: Group;
  effectivePreset: MusicianSetupPreset;
}): { musicianId: string; role: string; setup: MusicianSetupPreset } {
  return {
    musicianId: args.ownerMusicianId,
    role: args.ownerRole,
    setup: args.effectivePreset,
  };
}
