export type StageplanLine = {
  kind: "input" | "monitor" | "blank" | "riser";
  label: string;
  no?: number;
  instrumentKey?: string;
  raw?: unknown;
  group?: string;
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
  const label = formatStageplanBaseLabel(line.label, line.group);
  if (line.no == null) return label;
  if (label === "") return `(${line.no})`;
  return `${label} (${line.no})`;
}

function formatStageplanBaseLabel(label: string, group?: string): string {
  const trimmed = label.trim();
  if (group === "keys") {
    if (/^keys\b/i.test(trimmed)) return "Keys";
    if (/^synth\s*\(mono\)/i.test(trimmed) || /^synth\s+mono\b/i.test(trimmed)) return "Synth (mono)";
    if (/^synth\b/i.test(trimmed)) return "Synth";
  }
  return trimmed;
}

function arePairableBySameLabel(current: StageplanLine, next: StageplanLine): boolean {
  if (current.no == null || next.no == null) return false;
  const currentLabel = formatStageplanBaseLabel(current.label, current.group);
  const nextLabel = formatStageplanBaseLabel(next.label, next.group);
  if (currentLabel.toLowerCase() !== nextLabel.toLowerCase()) return false;
  if (/^synth\s*\(mono\)/i.test(currentLabel)) return false;
  return current.group === "keys" || /^(keys|synth|electric guitar|bass)\b/i.test(currentLabel);
}

function tryFindStereoPair(lines: StageplanLine[], start: number, used: Set<number>): number {
  const current = lines[start];
  if (current.kind !== "input" || current.no == null) return -1;

  const stereo = parseStereoLabel(current.label);
  if (!stereo || stereo.baseLabel.trim().toLowerCase() === "oh") return -1;

  for (let idx = start + 1; idx < lines.length; idx += 1) {
    if (used.has(idx)) continue;
    const candidate = lines[idx];
    if (candidate.kind !== "input" || candidate.no == null) continue;
    const candidateStereo = parseStereoLabel(candidate.label);
    if (!candidateStereo) continue;
    if (candidateStereo.baseLabel.toLowerCase() !== stereo.baseLabel.toLowerCase()) continue;
    if (candidateStereo.side === stereo.side) continue;
    return idx;
  }

  return -1;
}

export function formatStageplanInputLines(lines: StageplanLine[]): StageplanTextLine[] {
  const used = new Set<number>();
  const output: StageplanTextLine[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (used.has(index)) continue;
    const line = lines[index];

    if (line.kind === "input" && line.no != null) {
      const stereoPairIndex = tryFindStereoPair(lines, index, used);
      if (stereoPairIndex >= 0) {
        const pair = lines[stereoPairIndex]!;
        const baseLabel = formatStageplanBaseLabel(parseStereoLabel(line.label)?.baseLabel ?? line.label, line.group);
        const numbers = [line.no, pair.no!].sort((a, b) => a - b);
        output.push({ kind: line.kind, text: `${baseLabel} (${numbers[0]}+${numbers[1]})` });
        used.add(index);
        used.add(stereoPairIndex);
        continue;
      }

      const nextIndex = index + 1;
      if (nextIndex < lines.length && !used.has(nextIndex) && arePairableBySameLabel(line, lines[nextIndex]!)) {
        const nextLine = lines[nextIndex]!;
        const numbers = [line.no, nextLine.no!].sort((a, b) => a - b);
        const label = formatStageplanBaseLabel(line.label, line.group);
        output.push({ kind: line.kind, text: `${label} (${numbers[0]}+${numbers[1]})` });
        used.add(index);
        used.add(nextIndex);
        continue;
      }
    }

    output.push({ kind: line.kind, text: formatLine(line) });
    used.add(index);
  }

  return output;
}

export function collapseStereoForStageplan(lines: StageplanLine[]): StageplanTextLine[] {
  return formatStageplanInputLines(lines);
}
