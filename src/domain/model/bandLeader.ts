import type { Band } from "./types.js";

const BAND_LEADER_ERROR = (bandId: string): string =>
  `Band '${bandId}' must define bandLeader referencing an existing musician id.`;

export function resolveBandLeaderId(band: Band): string {
  const bandLeader = band.bandLeader?.trim();
  if (!bandLeader) {
    throw new Error(BAND_LEADER_ERROR(band.id));
  }
  return bandLeader;
}

export function isBandLeader(band: Band, musicianId: string): boolean {
  return musicianId === resolveBandLeaderId(band);
}

export function bandLeaderErrorMessage(bandId: string): string {
  return BAND_LEADER_ERROR(bandId);
}
