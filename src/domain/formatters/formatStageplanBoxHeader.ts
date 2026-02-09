type StageplanBoxHeaderArgs = {
  instrumentLabel: string;
  firstName?: string;
};

export function formatStageplanBoxHeader({
  instrumentLabel,
  firstName,
}: StageplanBoxHeaderArgs): string {
  const resolvedName = firstName && firstName.trim() ? firstName.trim() : "?";
  const displayInstrument = instrumentLabel === "Lead vocal" ? "Lead voc" : instrumentLabel;
  return `${displayInstrument} - ${resolvedName}`.toUpperCase();
}
