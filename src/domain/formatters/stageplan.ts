export type StageplanBoxHeaderArgs = {
  instrumentLabel: string;
  firstName?: string | null;
  isBandLeader?: boolean;
  hideMusicianNames?: boolean;
};

export function formatStageplanBoxHeader({
  instrumentLabel,
  firstName,
  isBandLeader = false,
  hideMusicianNames = false,
}: StageplanBoxHeaderArgs): string {
  const resolvedName = firstName && firstName.trim() ? firstName.trim() : "";
  const displayInstrument =
    instrumentLabel === "Lead vocal" ? "Lead voc" : instrumentLabel;
  const mainBase = !hideMusicianNames && resolvedName
    ? `${displayInstrument} – ${resolvedName}`
    : displayInstrument;
  const main = mainBase.toUpperCase();
  const suffix = isBandLeader ? " (band leader)" : "";
  return `${main}${suffix}`;
}

export function formatMonitorBullet(note: string, no: number): string {
  const label = note && note.trim() ? note.trim() : "";
  if (label === "") return `(${no})`;
  return `${label} (${no})`;
}

function formatStageplanMonitoringBaseLabel(label: string): string {
  const trimmed = label.trim();
  if (
    /^wedge monitor\s+\((provided by foh|requested from sound engineer)\)$/i.test(
      trimmed,
    )
  ) {
    return "Wedge monitor";
  }
  return trimmed;
}

const ADDITIONAL_WEDGE_PATTERN =
  /^(?<base>.*?)(?:\s*\+\s*Additional wedge monitor\s+(?<count>\d+)x)$/;

export function formatMonitorBullets(note: string, no: number): string[] {
  const label = note && note.trim() ? note.trim() : "";
  if (label === "") return [formatMonitorBullet("", no)];

  const match = label.match(ADDITIONAL_WEDGE_PATTERN);
  const count = match?.groups?.count;
  if (!count) return [formatMonitorBullet(formatStageplanMonitoringBaseLabel(label), no)];

  const base = formatStageplanMonitoringBaseLabel(match.groups?.base?.trim() ?? "");
  const primaryLine = formatMonitorBullet(base, no);
  return [primaryLine, `+ Additional wedge monitor ${count}x`];
}
