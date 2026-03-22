import type { NewProjectPayload } from "../../shell/types";

export function migrateProjectTalkbackOwner(
  project: NewProjectPayload,
): NewProjectPayload {
  if (Object.prototype.hasOwnProperty.call(project, "talkbackOwnerId"))
    return project;

  const legacyTalkBackOwnerId = (
    project as NewProjectPayload & { talkBackOwnerId?: unknown }
  ).talkBackOwnerId;
  if (typeof legacyTalkBackOwnerId === "string") {
    return {
      ...project,
      talkbackOwnerId: legacyTalkBackOwnerId.trim(),
    };
  }

  if (project.talkbackOverride?.mode === "none") {
    return { ...project, talkbackOwnerId: "" };
  }

  if (project.talkbackOverride?.mode === "assigned") {
    return { ...project, talkbackOwnerId: project.talkbackOverride.musicianId };
  }

  return project;
}
