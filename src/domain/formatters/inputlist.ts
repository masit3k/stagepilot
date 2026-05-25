function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

type StereoChannel = "L" | "R";

export type PdfInputChannelForCompaction = {
  ch: number;
  key: string;
  label: string;
  note?: string;
  baseLabel?: string;
  compactGroupKey?: string;
  channel?: string;
  ownerRole?: string;
  ownerMusicianId?: string;
};

export type PdfInputRow = {
  no: string;
  label: string;
  note?: string;
};

export function formatInputListNote(note?: string, duplicateCount = 1): string | undefined {
  const normalized = normalizeWs(note ?? "");
  if (normalized === "") return undefined;
  if (duplicateCount <= 1) return normalized;
  if (/^\d+x\s+/i.test(normalized)) return normalized;
  return `${duplicateCount}x ${normalized}`;
}

function isStereoChannel(value: string | undefined): value is StereoChannel {
  return value === "L" || value === "R";
}

function compactContextKey(input: PdfInputChannelForCompaction): string {
  return [
    input.ownerRole ?? "",
    input.ownerMusicianId ?? "",
    input.compactGroupKey ?? "",
  ].join("\u0000");
}

function countCompactContexts(
  inputs: PdfInputChannelForCompaction[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const input of inputs) {
    if (!input.compactGroupKey) continue;
    const key = compactContextKey(input);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function isValidStereoPair(
  a: PdfInputChannelForCompaction,
  b: PdfInputChannelForCompaction,
  contextCounts: Map<string, number>,
): boolean {
  if (!a.compactGroupKey || !b.compactGroupKey) return false;
  if (a.compactGroupKey !== b.compactGroupKey) return false;
  if (compactContextKey(a) !== compactContextKey(b)) return false;
  if (contextCounts.get(compactContextKey(a)) !== 2) return false;
  if (!a.baseLabel || !b.baseLabel || a.baseLabel !== b.baseLabel) return false;
  if (normalizeWs(a.note ?? "") !== normalizeWs(b.note ?? "")) return false;
  if (!isStereoChannel(a.channel) || !isStereoChannel(b.channel)) return false;
  return a.channel !== b.channel;
}

export function compactStereoInputChannelsForPdf(
  inputs: PdfInputChannelForCompaction[],
): PdfInputRow[] {
  const sorted = inputs.slice().sort((a, b) => a.ch - b.ch);
  const contextCounts = countCompactContexts(sorted);
  const rows: PdfInputRow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const compactLabel = a.baseLabel;

    if (compactLabel && b && b.ch === a.ch + 1 && isValidStereoPair(a, b, contextCounts)) {
      rows.push({
        no: `${a.ch}+${b.ch}`,
        label: compactLabel,
        note: formatInputListNote(a.note, 2),
      });
      i++;
      continue;
    }

    rows.push({
      no: String(a.ch),
      label: a.label,
      note: a.note,
    });
  }

  return rows;
}

function parseStereoLabel(label: string): { base: string; side: "L" | "R" } | null {
  const s = normalizeWs(label);

  {
    const m = s.match(/^(.*?)\s+(L|R)\s*(?=\(|$)/i);
    if (m) return { base: normalizeWs(m[1]), side: m[2].toUpperCase() as "L" | "R" };
  }

  {
    const m = s.match(/^(.*)\((L|R)\)$/i);
    if (m) return { base: normalizeWs(m[1]), side: m[2].toUpperCase() as "L" | "R" };
  }

  {
    const m = s.match(/^(.*)\s+[-–—]\s*(L|R)\s*$/i);
    if (m) return { base: normalizeWs(m[1]), side: m[2].toUpperCase() as "L" | "R" };
  }

  {
    const m = s.match(/^(.*?)\s+(Left|Right)\s*(?=\(|$)/i);
    if (m) {
      return {
        base: normalizeWs(m[1]),
        side: m[2].toLowerCase() === "left" ? "L" : "R",
      };
    }
  }

  return null;
}

function isOverheadsBase(baseLabel: string): boolean {
  const b = normalizeWs(baseLabel).toLowerCase();
  return b === "overhead" || b === "overheads" || b === "oh";
}

export function resolveStereoPair(
  a: { key: string; label: string; group: string; note?: string },
  b: { key: string; label: string; group: string; note?: string }
): { base: string; aSide: "L" | "R"; shouldCollapse: boolean } | null {
  if (a.group !== b.group) return null;
  if (normalizeWs(a.note ?? "") !== normalizeWs(b.note ?? "")) return null;

  const pa = parseStereoLabel(a.label);
  const pb = parseStereoLabel(b.label);
  if (pa && pb && pa.base === pb.base && pa.side !== pb.side) {
    return { base: pa.base, aSide: pa.side, shouldCollapse: !isOverheadsBase(pa.base) };
  }

  const ka = a.key.toLowerCase();
  const kb = b.key.toLowerCase();
  const aIsL = ka.endsWith("_l");
  const aIsR = ka.endsWith("_r");
  const bIsL = kb.endsWith("_l");
  const bIsR = kb.endsWith("_r");
  if ((aIsL && bIsR) || (aIsR && bIsL)) {
    const base = a.key.replace(/_l$/i, "").replace(/_r$/i, "");
    return { base, aSide: aIsL ? "L" : "R", shouldCollapse: !isOverheadsBase(base) };
  }

  return null;
}

