type TalkbackOverlay =
  | { mode?: unknown; ownerId?: unknown }
  | undefined;

export function resolveProjectTalkbackOwnerId(project: {
  overlays?: { talkback?: TalkbackOverlay };
} & Record<string, unknown>): string | undefined {
  const talkback = project.overlays?.talkback;
  if (talkback?.mode === "assigned" && typeof talkback.ownerId === "string") {
    const ownerId = talkback.ownerId.trim();
    if (ownerId.length > 0) return ownerId;
  }

  const legacyTalkbackOwnerId = project.talkbackOwnerId;
  if (typeof legacyTalkbackOwnerId === "string") return legacyTalkbackOwnerId;

  const legacyTalkBackOwnerId = project.talkBackOwnerId;
  if (typeof legacyTalkBackOwnerId === "string") return legacyTalkBackOwnerId;

  return undefined;
}

export function resolvePersistedTalkbackOwnerId(options: {
  existingTalkbackOwnerId?: string;
  defaultTalkbackOwnerId?: string;
  defaultBandLeaderId?: string;
}): string {
  const {
    existingTalkbackOwnerId,
    defaultTalkbackOwnerId,
    defaultBandLeaderId,
  } = options;

  if (typeof existingTalkbackOwnerId === "string") {
    return existingTalkbackOwnerId;
  }

  if (
    typeof defaultTalkbackOwnerId === "string" &&
    defaultTalkbackOwnerId.length > 0
  ) {
    return defaultTalkbackOwnerId;
  }

  if (
    typeof defaultBandLeaderId === "string" &&
    defaultBandLeaderId.length > 0
  ) {
    return defaultBandLeaderId;
  }

  return "";
}
