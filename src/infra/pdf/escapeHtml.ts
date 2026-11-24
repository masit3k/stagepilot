/**
 * Jediné escapování textu pro HTML šablonu PDF. Text z projektu (jména,
 * popisky, poznámky) se do šablony vkládá jako data, ne jako markup.
 * Ampersand jde první, jinak by se zdvojily entity vzniklé o řádek níž.
 */
export function escapeHtml(value: unknown): string {
  const str = value == null ? "" : String(value);
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
