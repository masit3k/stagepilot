export type StageplanLine = {
  kind: "input" | "monitor" | "blank" | "riser";
  label: string;
  no?: number;
  instrumentKey?: string;
  raw?: unknown;
};

type StereoSide = "L" | "R";

type StereoCandidate = {
  baseLabel: string;
  side: StereoSide;
};

type StageplanTextLine = {
  kind: StageplanLine["kind"];
  text: string;
};

const stereoPattern = /^(.*?)(?:\s+([LR]))(?:\s*\(.*\))?$/i;

function parseStereoLabel(label: string): StereoCandidate | null {
  const trimmed = label.trim();
  const match = stereoPattern.exec(trimmed);
  if (!match) return null;
  const baseLabel = (match[1] ?? "").trim();
  if (baseLabel === "") return null;
  return {
    baseLabel,
    side: (match[2] ?? "L").toUpperCase() as StereoSide,
  };
}

function formatLine(line: StageplanLine): string {
  const label = line.label.trim();
  if (line.no == null) return label;
  if (label === "") return `(${line.no})`;
  return `${label} (${line.no})`;
}

export function collapseStereoForStageplan(lines: StageplanLine[]): StageplanTextLine[] {
  const candidates = new Map<string, { L: StageplanLine[]; R: StageplanLine[] }>();

  for (const line of lines) {
    if (line.kind !== "input" || line.no == null) continue;
    const stereo = parseStereoLabel(line.label);
    if (!stereo) continue;
    if (stereo.baseLabel.trim().toLowerCase() === "oh") continue;
    const entry = candidates.get(stereo.baseLabel) ?? { L: [], R: [] };
    entry[stereo.side].push(line);
    candidates.set(stereo.baseLabel, entry);
  }

  const collapsibleBases = new Set<string>();
  for (const [baseLabel, entry] of candidates) {
    if (entry.L.length === 1 && entry.R.length === 1) {
      collapsibleBases.add(baseLabel);
    }
  }

  const used = new Set<string>();
  const output: StageplanTextLine[] = [];

  for (const line of lines) {
    if (line.kind === "input" && line.no != null) {
      const stereo = parseStereoLabel(line.label);
      if (stereo && collapsibleBases.has(stereo.baseLabel)) {
        if (!used.has(stereo.baseLabel)) {
          const entry = candidates.get(stereo.baseLabel);
          if (entry?.L[0]?.no != null && entry?.R[0]?.no != null) {
            const numbers = [entry.L[0].no, entry.R[0].no].sort((a, b) => a - b);
            output.push({
              kind: line.kind,
              text: `2x ${stereo.baseLabel} (${numbers[0]}+${numbers[1]})`,
            });
            used.add(stereo.baseLabel);
            continue;
          }
        } else {
          continue;
        }
      }
    }

    output.push({ kind: line.kind, text: formatLine(line) });
  }

  return output;
}
