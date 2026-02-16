import type { LineupMap } from "../../../projectRules";
import type { NewProjectPayload } from "../../shell/types";

type LegacyLineup = LineupMap & {
  vocs?: LineupMap[string];
  lead_vocs?: LineupMap[string];
  back_vocs?: LineupMap[string];
};

export function migrateProjectLineupVocsToLeadBack(
  project: NewProjectPayload,
): NewProjectPayload {
  const lineup = (project.lineup ?? {}) as LegacyLineup;
  const migrated: LegacyLineup = { ...lineup };

  if (!Object.prototype.hasOwnProperty.call(migrated, "lead_vocs") && migrated.vocs !== undefined) {
    migrated.lead_vocs = migrated.vocs;
  }

  if (!Object.prototype.hasOwnProperty.call(migrated, "back_vocs")) {
    migrated.back_vocs = [];
  }

  delete migrated.vocs;

  return {
    ...project,
    lineup: migrated,
  };
}

