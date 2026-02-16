import type { Group } from "../model/groups.js";
import type { InputChannel } from "../model/types.js";

const BASS_PRIORITY_BY_KEY: Readonly<Record<string, number>> = {
  el_bass_xlr_amp: 0,
  el_bass_xlr_pedalboard: 0,
  el_bass_mic: 1,
  bass_synth: 2,
};

export function compareInputsForRole(role: Group | undefined, a: InputChannel, b: InputChannel): number {
  if (role !== "bass") return 0;
  const aPriority = BASS_PRIORITY_BY_KEY[a.key] ?? Number.POSITIVE_INFINITY;
  const bPriority = BASS_PRIORITY_BY_KEY[b.key] ?? Number.POSITIVE_INFINITY;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return 0;
}

