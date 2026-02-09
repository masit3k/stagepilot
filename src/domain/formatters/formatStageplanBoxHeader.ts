import type { Band } from "../model/types.js";
import { isBandLeader } from "../model/bandLeader.js";

type StageplanBoxHeaderArgs = {
  instrumentLabel: string;
  musicianName: string;
  musicianId: string;
  band: Band;
};

export function formatStageplanBoxHeader({
  instrumentLabel,
  musicianName,
  musicianId,
  band,
}: StageplanBoxHeaderArgs): string {
  const suffix = isBandLeader(band, musicianId) ? " (band leader)" : "";
  return `${instrumentLabel} – ${musicianName}${suffix}`;
}
