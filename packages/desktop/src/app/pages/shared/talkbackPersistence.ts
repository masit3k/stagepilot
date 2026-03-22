export function resolvePersistedTalkbackOwnerId(options: {
  existingTalkbackOwnerId?: string;
  defaultBandLeaderId?: string;
}): string {
  const { existingTalkbackOwnerId, defaultBandLeaderId } = options;

  if (typeof existingTalkbackOwnerId === "string") {
    return existingTalkbackOwnerId;
  }

  if (
    typeof defaultBandLeaderId === "string" &&
    defaultBandLeaderId.length > 0
  ) {
    return defaultBandLeaderId;
  }

  return "";
}
