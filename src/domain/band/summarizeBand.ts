import { normalizeLineupAssignments } from "../lineup/lineupAssignments.js";
import { getAllLineupMemberIds } from "../model/bandLineup.js";

export type BandSummary = {
  readonly memberCount: number;
  readonly isIncomplete: boolean;
};

/**
 * R12: seznam kapel ukazuje počet členů a štítek „neúplná" (bez sestavy
 * nebo bez kapelníka). Vstup je syrový obsah souboru kapely: reálné
 * soubory nesou jen `bandLeaderId`, nové z editoru obě pole.
 */
export function summarizeBand(band: {
  readonly defaultLineup?: unknown;
  readonly bandLeader?: string;
  readonly bandLeaderId?: string;
}): BandSummary {
  const memberCount = getAllLineupMemberIds(
    normalizeLineupAssignments(band.defaultLineup),
  ).length;
  const leader =
    (band.bandLeader ?? "").trim() || (band.bandLeaderId ?? "").trim();
  return { memberCount, isIncomplete: memberCount === 0 || !leader };
}
