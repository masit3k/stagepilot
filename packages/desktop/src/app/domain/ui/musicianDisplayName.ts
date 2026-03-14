function toTitle(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanizeMusicianId(musicianId: string): string {
  return musicianId
    .trim()
    .split(/[_-]+/)
    .filter(Boolean)
    .map(toTitle)
    .join(" ");
}

export function resolveMusicianDisplayName(args: {
  musicianId: string;
  preferredName?: string | null;
}): string {
  const preferred = args.preferredName?.trim();
  if (preferred) return preferred;
  const humanized = humanizeMusicianId(args.musicianId);
  return humanized || args.musicianId;
}
