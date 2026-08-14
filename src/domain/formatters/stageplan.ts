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
  const mainBase =
    !hideMusicianNames && resolvedName
      ? `${displayInstrument} – ${resolvedName}`
      : displayInstrument;
  const main = mainBase.toUpperCase();
  // Hvězdička je značka poznámky pod čarou, ta se ke slovu tiskne bez mezery.
  // Vysvětlivku pod plánem sází renderer (R12, R13).
  const suffix = isBandLeader ? "*" : "";
  return `${main}${suffix}`;
}

export function formatMonitorBullet(note: string, no: number): string {
  const label = note && note.trim() ? note.trim() : "";
  if (label === "") return `(${no})`;
  return `${label} (${no})`;
}

/**
 * What? Drops the trailing "(provided by FOH)" / "(own)" supplier suffix
 * from a monitor label before it reaches the stageplan.
 * Why? The stageplan is a visual stage layout, not a supplier ledger — the
 * promoter reads supplier info from the monitor table and notes instead.
 * Shorter text also reduces overflow risk (box height is line-count based).
 * Mirrors `typeLabelOf` in packages/desktop/src/components/setup/monitorAxes.ts;
 * duplicated here because src/domain/ must not import desktop code.
 */
function formatStageplanMonitoringBaseLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const ADDITIONAL_WEDGE_PATTERN =
  /^(?<base>.*?)(?:\s*\+\s*Additional wedge monitor\s+(?<count>\d+)x)$/;

export function formatMonitorBullets(note: string, no: number): string[] {
  const label = note && note.trim() ? note.trim() : "";
  if (label === "") return [formatMonitorBullet("", no)];

  const match = label.match(ADDITIONAL_WEDGE_PATTERN);
  const count = match?.groups?.count;
  if (!count)
    return [formatMonitorBullet(formatStageplanMonitoringBaseLabel(label), no)];

  const base = formatStageplanMonitoringBaseLabel(
    match.groups?.base?.trim() ?? "",
  );
  const primaryLine = formatMonitorBullet(base, no);
  return [primaryLine, `+ Additional wedge monitor ${count}x`];
}
