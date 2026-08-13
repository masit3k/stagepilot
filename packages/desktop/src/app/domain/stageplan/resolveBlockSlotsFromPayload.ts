import type { StageplanBlockSlot } from "../../../../../../src/domain/model/types";
import { resolveStageplanBlockSlots } from "../../../../../../src/domain/stageplan/layout/resolveBlockSlots";
import type { LineupEntry, RichLineupValue } from "../../../projectRules";
import type { NewProjectPayload } from "../../shell/types";

/** Lineup v payloadu smí být string, objekt, nebo pole obojího. */
function toMusicianIds(value: RichLineupValue | undefined): string[] {
  if (value === undefined) return [];
  const entries: LineupEntry[] = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => {
    const id = typeof entry === "string" ? entry : entry.musicianId;
    const trimmed = id?.trim() ?? "";
    return trimmed ? [trimmed] : [];
  });
}

/**
 * Most mezi payloadem obrazovky a doménovým pravidlem. Když projekt nemá
 * overlay lead vokálů, bere se obsazení skupiny `vocs` — starší projekty
 * overlay nenesou.
 */
export function resolveBlockSlotsFromPayload(
  payload: Pick<NewProjectPayload, "lineup" | "overlays">,
): StageplanBlockSlot[] {
  const leadVocalIds =
    payload.overlays?.leadVocals ?? toMusicianIds(payload.lineup?.vocs);

  return resolveStageplanBlockSlots({
    musicianIdsByGroup: {
      drums: toMusicianIds(payload.lineup?.drums),
      bass: toMusicianIds(payload.lineup?.bass),
      guitar: toMusicianIds(payload.lineup?.guitar),
      keys: toMusicianIds(payload.lineup?.keys),
    },
    leadVocalIds,
  });
}
