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
    bandDefaultLineup: args.band.defaultLineup,
    bandDefaultTalkbackOwnerId: args.band.defaultTalkbackOwnerId,
    bandLeaderId: args.bandLeaderId,
  });

  const byMusicianId = new Map<string, MusicianSetupPreset>();
  for (const [role, musicianIds] of Object.entries(state.effectiveLineup) as Array<[Group, string[]]>) {
    for (const musicianId of musicianIds) {
      const musician = args.getMusicianById(musicianId);
      const defaultPreset = resolveDefaultMusicianSetup({
        role,
        musicianId,
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
        const drumPreset: MusicianSetupPreset = {
          inputs: resolveDrumDefinitionInputs(drumDefinition),
          monitoring: defaultPreset.monitoring,
        };
        // Bicí kanály nevznikají z presetu, takže sem `inputs.update` z R6
        // dřív nedosáhlo (task 12c) — patch se aplikuje až tady, po sestavení
        // kanálů ze `drumDefinition`. `buildDocument.ts` bicí (i basu) z
        // fallbackové patch cesty schválně vylučuje, protože obě role už mají
        // patch zapečený tady — dvojí aplikace by patch uplatnila dvakrát.
        //
        // Jen `update` — ne `add`/`removeKeys`/`replace` (fix round 1,
        // Critical 1). `drumDefinition` je jediný zdroj pravdy o tom, jaké
        // kanály bicí soupravy existují; editor kitu na obrazovce `01` do
        // stejného slotu spolu s `drumDefinition` ukládá i `{add,
        // removeKeys}` jako vlastní bookkeeping. Ten je vůči kanálům, které
        // `resolveDrumDefinitionInputs(drumDefinition)` už postavil,
        // redundantní z definice — přehrát ho by buď narazilo na kolizi klíče
        // (`applyPresetOverride` hází, když `add` cílí na klíč, co už v
        // seznamu je), nebo by tiše smazalo kanál, který `drumDefinition`
        // schválně chce mít aktivní. Obrazovka `02` navíc žádný takový zásah
        // nikdy nezapisuje — jen `update` (rename/note).
        const drumPatch = state.presetOverrideByMusicianId.get(musicianId);
        const narrowedDrumPatch: PresetOverridePatch | undefined = drumPatch?.inputs?.update?.length
          ? { inputs: { update: drumPatch.inputs.update } }
          : undefined;
        const effectiveDrumInputs = applyPresetOverride(drumPreset, narrowedDrumPatch).inputs;
        // Monitoring override reverted (fix round 1, Important 3): symmetry
        // with bass/guitar/keys wasn't asked for: no existing screen writes
        // a monitoring override on a drums slot, and `assertMonitorPresetRef`
        // added a throw path that didn't exist before task 12c. A drums
        // slot's monitoring stays exactly what it was: the musician's own
        // default.
        byMusicianId.set(musicianId, {
          inputs: effectiveDrumInputs,
          monitoring: defaultPreset.monitoring,
        });
        continue;
      }
      const patch: PresetOverridePatch | undefined = state.presetOverrideByMusicianId.get(musicianId);
      const effectivePreset = applyPresetOverride(defaultPreset, patch);
      if (patch?.monitoring?.monitorRef) {
        assertMonitorPresetRef({
          ref: patch.monitoring.monitorRef,
          role,
          musicianId,
          getPresetByRef: args.getPresetByRef,
        });
      }
      byMusicianId.set(musicianId, effectivePreset);
    }
  }

  return {
    lineup: state.effectiveLineup,
    byMusicianId,
    talkbackOwnerId: state.effectiveTalkbackOwnerId,
  };
}

function assertMonitorPresetRef(args: {
  ref: string;
  role: Group;
  musicianId: string;
  getPresetByRef: (ref: string) => PresetEntity | undefined;
}): void {
  let entity: PresetEntity | undefined;
  try {
    entity = args.getPresetByRef(args.ref);
  } catch {
    entity = undefined;
  }
  const context = ` while resolving monitoring override for musician "${args.musicianId}" (role: ${args.role})`;
  if (!entity) {
    throw new Error(`Missing monitor preset reference "${args.ref}"${context}.`);
  }
  if (entity.type !== "monitor") {
    throw new Error(
      `Monitor preset reference "${args.ref}" points to type "${entity.type}", expected "monitor"${context}.`,
    );
  }
}
