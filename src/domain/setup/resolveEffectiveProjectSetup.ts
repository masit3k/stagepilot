import type { Group } from "../model/groups.js";
import { createDefaultDrumDefinition, parsePersistedDrumDefinition } from "../drums/drumDefinition.js";
import { resolveDrumDefinitionInputs } from "../drums/resolveDrumDefinitionInputs.js";
import type {
  Band,
  Musician,
  MusicianSetupPreset,
  PresetEntity,
  PresetOverridePatch,
  Project,
} from "../model/types.js";
import { applyPresetOverride } from "../rules/presetOverride.js";
import { resolveEffectiveProjectState } from "../pipeline/resolveEffectiveProjectState.js";
import { resolveDefaultMusicianSetup } from "./resolveDefaultMusicianSetup.js";

export type EffectiveProjectSetup = {
  lineup: Record<Group, string[]>;
  byMusicianId: Map<string, MusicianSetupPreset>;
  talkbackOwnerId: string;
};

export function resolveEffectiveProjectSetup(args: {
  project: Project;
  band: Band;
  bandLeaderId: string;
  getMusicianById: (id: string) => Musician;
  getPresetByRef: (ref: string) => PresetEntity | undefined;
  musicianDefaultsById?: Record<string, Partial<MusicianSetupPreset>>;
}): EffectiveProjectSetup {
  const state = resolveEffectiveProjectState({
    project: args.project,
    bandDefaultLineup: args.band.defaultLineup ?? {},
    bandLeaderId: args.bandLeaderId,
  });

  const byMusicianId = new Map<string, MusicianSetupPreset>();
  for (const [role, musicianIds] of Object.entries(state.effectiveLineup) as Array<[Group, string[]]>) {
    for (const musicianId of musicianIds) {
      const musician = args.getMusicianById(musicianId);
      const defaultPreset = resolveDefaultMusicianSetup({
        role,
        presetItems: musician.presets,
        musicianDefaults: args.musicianDefaultsById?.[musicianId],
        getPresetByRef: args.getPresetByRef,
      });
      if (role === "drums") {
        const musicianPresetDefinition = musician.presets.find((item) => item.kind === "drum_setup")?.setup;
        const drumDefinition =
          state.drumDefinitionByMusicianId.get(musicianId) ??
          (musicianPresetDefinition
            ? parsePersistedDrumDefinition(musicianPresetDefinition, `musician ${musicianId} drum_setup`)
            : createDefaultDrumDefinition());
        byMusicianId.set(musicianId, {
          inputs: resolveDrumDefinitionInputs(drumDefinition),
          monitoring: defaultPreset.monitoring,
        });
        continue;
      }
      const patch: PresetOverridePatch | undefined = state.presetOverrideByMusicianId.get(musicianId);
      byMusicianId.set(musicianId, applyPresetOverride(defaultPreset, patch));
    }
  }

  return {
    lineup: state.effectiveLineup,
    byMusicianId,
    talkbackOwnerId: state.effectiveTalkbackOwnerId,
  };
}
