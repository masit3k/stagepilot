import type { DataRepository } from "../../infra/fs/repo.js";
import type { Band } from "../model/types.js";
import { bandLeaderErrorMessage, resolveBandLeaderId } from "../model/bandLeader.js";

export function validateBandLeader(band: Band, repo: DataRepository): string {
  const bandLeaderId = resolveBandLeaderId(band);
  try {
    repo.getMusician(bandLeaderId);
  } catch {
    throw new Error(bandLeaderErrorMessage(band.id));
  }
  return bandLeaderId;
}
