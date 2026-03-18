import { normalizeLineupValue, type LineupMap } from "../../../projectRules";
import type { NewProjectPayload } from "../../shell/types";

type LegacyLineup = LineupMap & {
  lead_vocs?: LineupMap[string];
  vocs?: LineupMap[string];
};

export function migrateProjectLineupVocsToLeadBack(
  project: NewProjectPayload,
): NewProjectPayload {
  const lineup = (project.lineup ?? {}) as LegacyLineup;
  const migrated: LegacyLineup = { ...lineup };

  if (
    !Object.prototype.hasOwnProperty.call(migrated, "vocs") &&
    migrated.lead_vocs !== undefined
  ) {
    migrated.vocs = migrated.lead_vocs;
  }

  const hasExplicitLeadVocalistIds = Object.prototype.hasOwnProperty.call(
    project,
    "leadVocalistIds",
  );
  const legacyLeadVocalistIds = normalizeLineupValue(migrated.lead_vocs, 8);

  delete migrated.lead_vocs;

  return {
    ...project,
    lineup: migrated,
    ...(!hasExplicitLeadVocalistIds && lineup.lead_vocs !== undefined
      ? { leadVocalistIds: legacyLeadVocalistIds }
      : {}),
  };
}
