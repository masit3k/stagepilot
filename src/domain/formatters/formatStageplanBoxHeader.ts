type StageplanBoxHeaderArgs = {
  instrumentLabel: string;
  firstName?: string;
};

export function formatStageplanBoxHeader({
  instrumentLabel,
  firstName,
}: StageplanBoxHeaderArgs): string {
  const resolvedName = firstName && firstName.trim() ? firstName.trim() : "?";
  return `${instrumentLabel}_${resolvedName}`.toUpperCase();
}
