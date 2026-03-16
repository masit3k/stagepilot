export function resolvePersistedTalkbackOwnerId(options: {
  existingTalkbackOwnerId?: string;
  defaultBandLeaderId?: string;
}): string | undefined {
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

  return undefined;
}
