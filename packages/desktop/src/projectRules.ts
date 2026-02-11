export type RoleConstraint = {
  min: number;
  max: number;
};

export type LineupValue = string | string[];
export type LineupMap = Record<string, LineupValue | undefined>;

const PROJECT_DETAIL_PATTERN = /^\/projects\/([^/]+)$/;
const PROJECT_SETUP_PATTERN = /^\/projects\/([^/]+)\/setup$/;
const RESERVED_PROJECT_IDS = new Set(["new"]);

export function matchProjectDetailPath(pathname: string): string | null {
  const match = pathname.match(PROJECT_DETAIL_PATTERN);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return RESERVED_PROJECT_IDS.has(id) ? null : id;
}

export function matchProjectSetupPath(pathname: string): string | null {
  const match = pathname.match(PROJECT_SETUP_PATTERN);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getTodayIsoLocal(now = new Date()): string {
  const localMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const yyyy = localMidnight.getFullYear();
  const mm = String(localMidnight.getMonth() + 1).padStart(2, "0");
  const dd = String(localMidnight.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseUsDateInput(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function formatIsoDateToUs(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return "";
  return `${month}/${day}/${year}`;
}

export function isPastIsoDate(isoDate: string, todayIso: string): boolean {
  return isoDate < todayIso;
}

export function normalizeLineupValue(
  value: LineupValue | undefined,
  maxSlots: number,
): string[] {
  if (!value) return [];
  const ids = Array.isArray(value) ? value : [value];
  return ids.filter(Boolean).slice(0, Math.max(maxSlots, 0));
}

export function normalizeRoleConstraint(
  role: string,
  constraint?: RoleConstraint,
): RoleConstraint {
  if (!constraint) {
    return role === "vocs" ? { min: 0, max: 4 } : { min: 0, max: 1 };
  }
  const min = Math.max(0, Math.floor(constraint.min));
  let max = Math.max(min, Math.floor(constraint.max));
  if (role === "vocs") {
    if (!Number.isFinite(max) || max <= 0 || max > 8) {
      max = 4;
    }
  } else if (!Number.isFinite(max) || max > 2) {
    max = 1;
  }
  return { min: Math.min(min, max), max };
}

export function validateLineup(
  lineup: LineupMap,
  constraints: Record<string, RoleConstraint>,
  roleOrder: string[],
): string[] {
  const errors: string[] = [];
  for (const role of roleOrder) {
    const roleConstraint = normalizeRoleConstraint(role, constraints[role]);
    const selected = normalizeLineupValue(lineup[role], roleConstraint.max);
    if (
      selected.length < roleConstraint.min ||
      selected.length > roleConstraint.max
    ) {
      errors.push(
        `${role}: expected ${roleConstraint.min === roleConstraint.max ? roleConstraint.min : `${roleConstraint.min}-${roleConstraint.max}`} slot(s), selected ${selected.length}.`,
      );
    }
  }
  return errors;
}

export function getUniqueSelectedMusicians(
  lineup: LineupMap,
  constraints: Record<string, RoleConstraint>,
  roleOrder: string[],
): string[] {
  const ids = new Set<string>();
  for (const role of roleOrder) {
    const roleConstraint = normalizeRoleConstraint(role, constraints[role]);
    for (const id of normalizeLineupValue(lineup[role], roleConstraint.max)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}
