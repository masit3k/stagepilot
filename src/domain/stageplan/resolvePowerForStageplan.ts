import type {
  Band,
  Musician,
  Project,
  StageplanInstrumentKey,
  PowerRequirement,
} from "../model/types.js";
import type { LineupValue } from "../model/types.js";

function firstMemberId(value: LineupValue | undefined): string | null {
  if (!value) return null;
  const ids = Array.isArray(value) ? value : [value];
  return ids[0] ?? null;
}

export function resolvePowerForStageplan(
  roleKey: StageplanInstrumentKey,
  band: Band,
  project: Project,
  musiciansById: Map<string, Musician>
): PowerRequirement | null {
  const musicianId = firstMemberId(band.defaultLineup?.[roleKey]);
  if (!musicianId) return null;

  const override = project.stageplan?.powerOverridesByMusician?.[musicianId];
  const musicianDefault = musiciansById.get(musicianId)?.requirements?.power;
  return override ?? musicianDefault ?? null;
}
