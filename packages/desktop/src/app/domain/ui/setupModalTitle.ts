export function composeSetupModalTitle(args: {
  templateType: "event" | "generic";
  musicianName: string;
  instrumentLabels: string[];
}): string {
  const prefix =
    args.templateType === "event" ? "Setup for this event" : "Setup";
  const labels = Array.from(new Set(args.instrumentLabels.map((label) => label.trim()).filter(Boolean)));
  if (labels.length === 0) return `${prefix} – ${args.musicianName}`;
  return `${prefix} – ${args.musicianName} (${labels.join(", ")})`;
}
