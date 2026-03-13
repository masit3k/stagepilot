import type { NewProjectPayload } from "../../shell/types";

export function migrateProjectTalkbackOwner(
  project: NewProjectPayload,
): NewProjectPayload {
  if (project.talkbackOverride) return project;

  const bandLeaderId = project.bandLeaderId?.trim() ?? "";
  const talkbackOwnerId = project.talkbackOwnerId?.trim() ?? "";

  if (!bandLeaderId) return project;
  if (talkbackOwnerId) return { ...project, talkbackOverride: { mode: "assigned", musicianId: talkbackOwnerId } };
  if (Object.prototype.hasOwnProperty.call(project, "talkbackOwnerId")) {
    return { ...project, talkbackOverride: { mode: "none" } };
  }

  return {
    ...project,
    talkbackOwnerId: bandLeaderId,
  };
}
