export type RoleConstraint = {
  min: number;
  max: number;
};

export type LineupValue = string | string[];
export type LineupMap = Record<string, LineupValue | undefined>;

const PROJECT_DETAIL_PATTERN = /^\/projects\/([^/]+)$/;
const PROJECT_SETUP_PATTERN = /^\/projects\/([^/]+)\/setup$/;
const PROJECT_EVENT_PATTERN = /^\/projects\/([^/]+)\/event$/;
const PROJECT_GENERIC_PATTERN = /^\/projects\/([^/]+)\/generic$/;
const PROJECT_PREVIEW_PATTERN =
  /^\/projects\/([^/]+)\/(?:preview|pdf-preview)$/;
const RESERVED_PROJECT_IDS = new Set(["new"]);

function decodeProjectId(match: RegExpMatchArray | null): string | null {
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return RESERVED_PROJECT_IDS.has(id) ? null : id;
}

export function matchProjectDetailPath(pathname: string): string | null {
  return decodeProjectId(pathname.match(PROJECT_DETAIL_PATTERN));
}

export function matchProjectSetupPath(pathname: string): string | null {
  return decodeProjectId(pathname.match(PROJECT_SETUP_PATTERN));
}

export function matchProjectPreviewPath(pathname: string): string | null {
  return decodeProjectId(pathname.match(PROJECT_PREVIEW_PATTERN));
}

export function matchProjectEventPath(pathname: string): string | null {
  return decodeProjectId(pathname.match(PROJECT_EVENT_PATTERN));
}

export function matchProjectGenericPath(pathname: string): string | null {
  return decodeProjectId(pathname.match(PROJECT_GENERIC_PATTERN));
}

export function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizeCity(city: string): string {
  const noDiacritics = removeDiacritics(city.trim());
  return noDiacritics
    .split(" ")
    .filter(Boolean)
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}`)
    .join("-");
}

export function buildExportFileName(projectId: string): string {
  return `${projectId}.pdf`;
}

export function shouldPromptUnsavedChanges(
  isDirty: boolean,
  trigger: "route-change" | "history-back" | "cancel" | "back" | "home",
): boolean {
  if (!isDirty) return false;
  return ["route-change", "history-back", "cancel", "back", "home"].includes(
    trigger,
  );
}

export function sanitizeVenueSlug(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (segment) =>
        `${segment.slice(0, 1).toUpperCase()}${segment.slice(1).toLowerCase()}`,
    )
    .join("-")
    .replace(/-+/g, "-")
    .slice(0, 50);
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

export function getCurrentYearLocal(now = new Date()): number {
  return now.getFullYear();
}

export function isValidityYearInPast(
  yearValue: string,
  currentYear = getCurrentYearLocal(),
): boolean {
  if (!/^\d{4}$/.test(yearValue)) return false;
  return Number(yearValue) < currentYear;
}

export function parseUsDateInput(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
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
  return `${day}/${month}/${year}`;
}

export function formatIsoToDateTimeDisplay(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  const hours = String(dt.getHours()).padStart(2, "0");
  const minutes = String(dt.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function autoFormatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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

export function getRoleDisplayName(
  role: string,
  constraints?: Record<string, RoleConstraint>,
): string {
  if (role === "vocs") {
    const vocConstraint = normalizeRoleConstraint(role, constraints?.[role]);
    if (vocConstraint.min === 1 && vocConstraint.max === 1) return "LEAD VOC";
    return "VOCS";
  }
  const names: Record<string, string> = {
    drums: "DRUMS",
    bass: "BASS",
    guitar: "GUITAR",
    keys: "KEYS",
    leader: "BAND LEADER",
    talkback: "TALKBACK",
  };
  return names[role] ?? role.toUpperCase();
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
        `${getRoleDisplayName(role, constraints)}: expected ${roleConstraint.min === roleConstraint.max ? roleConstraint.min : `${roleConstraint.min}-${roleConstraint.max}`} slot(s), selected ${selected.length}.`,
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

export function resolveBandLeaderId(args: {
  selectedMusicianIds: string[];
  storedBandLeaderId?: string;
  bandLeaderId?: string | null;
  defaultContactId?: string | null;
}): string {
  const {
    selectedMusicianIds,
    storedBandLeaderId,
    bandLeaderId,
    defaultContactId,
  } = args;
  if (storedBandLeaderId && selectedMusicianIds.includes(storedBandLeaderId)) {
    return storedBandLeaderId;
  }
  if (bandLeaderId && selectedMusicianIds.includes(bandLeaderId)) {
    return bandLeaderId;
  }
  if (defaultContactId && selectedMusicianIds.includes(defaultContactId)) {
    return defaultContactId;
  }
  return selectedMusicianIds[0] ?? "";
}

export function resolveTalkbackOwnerId(args: {
  selectedMusicianIds: string[];
  bandLeaderId: string;
  storedTalkbackOwnerId?: string;
}): string {
  const { selectedMusicianIds, bandLeaderId, storedTalkbackOwnerId } = args;
  if (
    storedTalkbackOwnerId &&
    selectedMusicianIds.includes(storedTalkbackOwnerId)
  ) {
    return storedTalkbackOwnerId;
  }
  return bandLeaderId;
}
