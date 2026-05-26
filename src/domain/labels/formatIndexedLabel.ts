export function formatIndexedLabel(
  base: string,
  total: number,
  index: number,
): string {
  return total <= 1 ? base : `${base} ${index + 1}`;
}
