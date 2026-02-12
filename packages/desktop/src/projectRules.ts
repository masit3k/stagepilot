import {
  formatEventDateForDisplayName,
  formatEventDateForSlug,
  formatProjectDisplayName as formatProjectDisplayNameFromDomain,
  formatProjectSlug as formatProjectSlugFromDomain,
  sanitizeSlugSegment,
} from "../../../src/domain/projectNaming";

export type RoleConstraint = {
  min: number;
  max: number;
};

export type RoleLabelConstraints = {
  vocs?: {
    lead?: RoleConstraint;
  };
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

const LIBRARY_BAND_DETAIL_PATTERN = /^\/library\/bands\/([^/]+)$/;

export function matchLibraryBandDetailPath(pathname: string): string | null {
  const match = pathname.match(LIBRARY_BAND_DETAIL_PATTERN);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

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

export function buildExportFileName(projectSlug: string): string {
  // Uses slug (human doc key), not id (UUID).
  return `${projectSlug}.pdf`;
}

export {
  formatEventDateForDisplayName,
  formatEventDateForSlug,
  sanitizeSlugSegment,
};

export function formatProjectSlug(project: {
  purpose?: "event" | "generic";
  eventDate?: string;
  eventVenue?: string;
  documentDate?: string;
  note?: string;
}, band: { id: string; code?: string | null; name: string }): string {
  return formatProjectSlugFromDomain(project, band);
}

export function formatProjectDisplayName(project: {
  purpose?: "event" | "generic";
  eventDate?: string;
  eventVenue?: string;
  documentDate?: string;
  note?: string;
}, band: { id: string; code?: string | null; name: string }): string {
  return formatProjectDisplayNameFromDomain(project, band);
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
  return sanitizeSlugSegment(value);
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
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseIsoDateToIso(trimmed);
  }
  return parseDDMMYYYYToISO(trimmed);
}

export function formatDateDigitsToDDMMYYYY(digits: string): string {
  const clean = digits.replace(/\D/g, "").slice(0, 8);
  const day = clean.slice(0, 2);
  const month = clean.slice(2, 4);
  const year = clean.slice(4, 8);
  if (clean.length <= 2) return day;
  if (clean.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

export function parseDDMMYYYYToISO(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  return validateDatePartsToIso(year, month, day);
}

export function acceptISOToDDMMYYYY(iso: string): string {
  const normalized = parseIsoDateToIso(iso);
  if (!normalized) return "";
  return formatIsoDateToUs(normalized);
}

function parseIsoDateToIso(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return validateDatePartsToIso(year, month, day);
}

function validateDatePartsToIso(
  year: number,
  month: number,
  day: number,
): string | null {
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
  roleConstraints?: RoleLabelConstraints,
): string {
  if (role === "vocs") {
    const leadVocConstraint = roleConstraints?.vocs?.lead;
    const vocConstraint = normalizeRoleConstraint(
      role,
      leadVocConstraint ?? constraints?.[role],
    );
    if (vocConstraint.max === 1) return "LEAD VOC";
    return "LEAD VOCS";
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
  roleConstraints?: RoleLabelConstraints,
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
        `${getRoleDisplayName(role, constraints, roleConstraints)}: expected ${roleConstraint.min === roleConstraint.max ? roleConstraint.min : `${roleConstraint.min}-${roleConstraint.max}`} slot(s), selected ${selected.length}.`,
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
