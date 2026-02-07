function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getTodayLocalDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function getGeneratedAtUtc(): string {
  return new Date().toISOString();
}
