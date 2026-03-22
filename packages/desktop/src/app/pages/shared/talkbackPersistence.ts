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
