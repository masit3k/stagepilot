/**
 * Počet stránek v hotovém PDF. Druhá vrstva pojistky proti přetečení: DOM
 * kontrola měří layout na obrazovce, tohle měří, co Chromium doopravdy zalomilo.
 */
export function countPdfPages(buffer: Buffer): number {
  const content = buffer.toString("latin1");
  // \b za Page odmítne /Type /Pages, což je kořen stromu stránek.
  const matches = content.match(/\/Type\s*\/Page\b/g) ?? [];
  return matches.length;
}
