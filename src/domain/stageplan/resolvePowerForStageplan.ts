import type {
  Musician,
  Project,
  StageplanInstrumentKey,
  PowerRequirement,
} from "../model/types.js";
import type { Group } from "../model/groups.js";

export function resolvePowerForStageplan(
  roleKey: StageplanInstrumentKey,
  lineup: Record<Group, string[]>,
  project: Project,
  musiciansById: Map<string, Musician>
): PowerRequirement | null {
  const musicianId = lineup[roleKey]?.[0] ?? null;
  if (!musicianId) return null;

  const override = project.stageplan?.powerOverridesByMusician?.[musicianId];
  const musicianDefault = musiciansById.get(musicianId)?.requirements?.power;
  return override ?? musicianDefault ?? null;
}
