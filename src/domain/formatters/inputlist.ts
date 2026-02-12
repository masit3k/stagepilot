function normalizeWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function formatInputListNote(note?: string, duplicateCount = 1): string | undefined {
  const normalized = normalizeWs(note ?? "");
  if (normalized === "") return undefined;
  if (duplicateCount <= 1) return normalized;
  if (/^\d+x\s+/i.test(normalized)) return normalized;
  return `${duplicateCount}x ${normalized}`;
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

export function formatInputListLabel(leftLabel: string, rightLabel: string): string {
  const clean = (s: string): string => {
    let x = normalizeWs(s);
    x = x.replace(/\s+(L|R)\s*$/i, "").trim();
    x = x.replace(/\(([^()]*)\b(L|R)\b([^()]*)\)\s*$/i, "($1$3)");
    x = x.replace(/\s+\)/g, ")");
    x = normalizeWs(x);
    x = x.replace(/\s+(L|R)\s*\(/i, " (");
    return normalizeWs(x);
  };

  const l = clean(leftLabel);
  const r = clean(rightLabel);

  if (l !== "" && l === r) return l;
  return l || normalizeWs(leftLabel);
}
