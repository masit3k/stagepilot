type StageplanBoxHeaderArgs = {
  instrumentLabel: string;
  firstName?: string;
  isBandLeader?: boolean;
};

export function formatStageplanBoxHeader({
  instrumentLabel,
  firstName,
  isBandLeader = false,
}: StageplanBoxHeaderArgs): string {
  const resolvedName = firstName && firstName.trim() ? firstName.trim() : "";
  const displayInstrument = instrumentLabel === "Lead vocal" ? "Lead voc" : instrumentLabel;
  const mainBase = resolvedName ? `${displayInstrument} – ${resolvedName}` : displayInstrument;
  const main = mainBase.toUpperCase();
  const suffix = isBandLeader ? " (band leader)" : "";
  return `${main}${suffix}`;
}
