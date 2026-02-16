import type { NewProjectPayload } from "../../shell/types";

export function migrateProjectTalkbackOwner(
  project: NewProjectPayload,
): NewProjectPayload {
  const bandLeaderId = project.bandLeaderId?.trim() ?? "";
  const talkbackOwnerId = project.talkbackOwnerId?.trim() ?? "";

  if (!bandLeaderId) return project;
  if (talkbackOwnerId) return project;

  return {
    ...project,
    talkbackOwnerId: bandLeaderId,
  };
}
