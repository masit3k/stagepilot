import type { NewProjectPayload } from "../../shell/types";

export function migrateProjectTalkbackOwner(
  project: NewProjectPayload,
): NewProjectPayload {
  const explicitTalkback = project.overlays?.talkback;
  if (explicitTalkback?.mode === "assigned" || explicitTalkback?.mode === "none") {
    return project;
  }

  const legacyTalkbackOwnerId =
    typeof (project as NewProjectPayload & { talkbackOwnerId?: unknown }).talkbackOwnerId === "string"
      ? (project as NewProjectPayload & { talkbackOwnerId: string }).talkbackOwnerId.trim()
      : typeof (project as NewProjectPayload & { talkBackOwnerId?: unknown }).talkBackOwnerId === "string"
        ? (project as NewProjectPayload & { talkBackOwnerId: string }).talkBackOwnerId.trim()
        : undefined;

  if (legacyTalkbackOwnerId !== undefined) {
    return {
      ...project,
      overlays: {
        ...(project.overlays ?? {}),
        talkback:
          legacyTalkbackOwnerId.length > 0
            ? { mode: "assigned", ownerId: legacyTalkbackOwnerId }
            : { mode: "none", ownerId: null },
      },
      talkbackOwnerId: undefined,
    };
  }

  if (project.talkbackOverride?.mode === "none") {
    return {
      ...project,
      overlays: {
        ...(project.overlays ?? {}),
        talkback: { mode: "none", ownerId: null },
      },
    };
  }

  if (project.talkbackOverride?.mode === "assigned") {
    return {
      ...project,
      overlays: {
        ...(project.overlays ?? {}),
        talkback: { mode: "assigned", ownerId: project.talkbackOverride.musicianId },
      },
    };
  }

  return project;
}
