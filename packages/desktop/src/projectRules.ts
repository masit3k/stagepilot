import {
  type DrumDefinition,
  parseDrumDefinition,
} from "../../../src/domain/drums/drumDefinition";
import { dedupeLineupIds } from "../../../src/domain/lineup/lineupAssignments";
import {
  formatEventDateForDisplayName,
  formatEventDateForSlug,
  formatProjectDisplayName as formatProjectDisplayNameFromDomain,
  formatProjectSlug as formatProjectSlugFromDomain,
  sanitizeSlugSegment,
} from "../../../src/domain/projectNaming";

const ROLE_SLOT_LIMITS: Record<string, number> = {
  vocs: 4,
  talkback: 1,
};

export type LineupValue = RichLineupValue;
export type LineupMap = RichLineupMap;

export type MonitoringPreset = {
  monitorRef?: string;
  additionalWedgeCount?: number;
};

export type InputDef = {
  key: string;
  label: string;
  note?: string;
  group?: "drums" | "bass" | "guitar" | "keys" | "vocs" | "talkback";
};

export type PartialInputUpdate = {
  key: string;
  label?: string;
  note?: string;
  group?: InputDef["group"];
};

export type PresetOverridePatch = {
  monitoring?: Partial<MonitoringPreset>;
  inputs?: {
    add?: InputDef[];
    remove?: string[];
    replace?: Array<{ targetKey: string; with: InputDef }>;
    removeKeys?: string[];
    update?: PartialInputUpdate[];
  };
};

export type LineupSlotValue = {
  musicianId: string;
  presetOverride?: PresetOverridePatch;
  drumDefinition?: DrumDefinition;
};

export type LineupEntry = string | LineupSlotValue;

export type RichLineupValue = LineupEntry | LineupEntry[];
export type RichLineupMap = Record<string, RichLineupValue | undefined>;

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

export function formatProjectSlug(
  project: {
    purpose?: "event" | "generic";
    eventDate?: string;
    eventVenue?: string;
    documentDate?: string;
    note?: string;
  },
  band: { id: string; code?: string | null; name: string },
): string {
  return formatProjectSlugFromDomain(project, band);
}

export function formatProjectDisplayName(
  project: {
    purpose?: "event" | "generic";
    eventDate?: string;
    eventVenue?: string;
    documentDate?: string;
    note?: string;
  },
  band: { id: string; code?: string | null; name: string },
): string {
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

function countLineupEntries(value: RichLineupValue | undefined): number {
  if (!value) return 0;
  return Array.isArray(value) ? value.length : 1;
}

export function normalizeLineupValue(
  value: RichLineupValue | undefined,
  maxSlots: number,
): string[] {
  if (!value) return [];
  const ids = Array.isArray(value) ? value : [value];
  return dedupeLineupIds(
    ids.map((entry) =>
      typeof entry === "string" ? entry : (entry?.musicianId ?? ""),
    ),
  ).slice(0, Math.max(maxSlots, 0));
}

export function normalizeLineupSlots(
  value: RichLineupValue | undefined,
  maxSlots: number,
): LineupSlotValue[] {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const normalized: LineupSlotValue[] = [];
  for (const entry of entries) {
    const slot = (() => {
      if (typeof entry === "string") return { musicianId: entry };
      if (!entry || typeof entry !== "object") return null;
      const musicianId =
        typeof entry.musicianId === "string" ? entry.musicianId : "";
      if (!musicianId) return null;
      const normalized = {
        musicianId,
        presetOverride: entry.presetOverride,
      } as LineupSlotValue;
      if (entry.drumDefinition && typeof entry.drumDefinition === "object") {
        normalized.drumDefinition = parseDrumDefinition(entry.drumDefinition);
      }
      return normalized;
    })();
    const musicianId = slot?.musicianId.trim() ?? "";
    if (!slot || !musicianId || seen.has(musicianId)) continue;
    seen.add(musicianId);
    normalized.push({ ...slot, musicianId });
  }
  return normalized.slice(0, Math.max(maxSlots, 0));
}

export function addMusicianToLineupRole(
  lineup: LineupMap,
  role: string,
  musicianId: string,
): LineupMap {
  return addMusiciansToLineupRole(lineup, role, [musicianId]);
}

export function addMusiciansToLineupSlots(
  slots: RichLineupValue | undefined,
  musicianIds: string[],
  maxSlots: number,
): LineupSlotValue[] {
  const next = normalizeLineupSlots(slots, maxSlots);
  const seen = new Set(next.map((slot) => slot.musicianId));
  for (const musicianId of musicianIds) {
    const trimmed = musicianId.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push({ musicianId: trimmed });
    if (next.length >= Math.max(maxSlots, 0)) break;
  }
  return next;
}

export function addMusiciansToLineupRole(
  lineup: LineupMap,
  role: string,
  musicianIds: string[],
): LineupMap {
  const roleSlotLimit = getRoleSlotLimit(role);
  const current = normalizeLineupSlots(lineup[role], roleSlotLimit);
  const next = addMusiciansToLineupSlots(current, musicianIds, roleSlotLimit);
  if (next.length === current.length) {
    return lineup;
  }
  return { ...lineup, [role]: next };
}

export function removeMusicianFromLineupRole(
  lineup: LineupMap,
  role: string,
  musicianId: string,
): LineupMap {
  const roleSlotLimit = getRoleSlotLimit(role);
  const current = normalizeLineupSlots(lineup[role], roleSlotLimit);
  return {
    ...lineup,
    [role]: current.filter((slot) => slot.musicianId !== musicianId),
  };
}

export function moveMusicianInLineupRole(
  lineup: LineupMap,
  role: string,
  fromIndex: number,
  toIndex: number,
): LineupMap {
  const roleSlotLimit = getRoleSlotLimit(role);
  const current = normalizeLineupSlots(lineup[role], roleSlotLimit);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= current.length ||
    toIndex >= current.length ||
    fromIndex === toIndex
  ) {
    return lineup;
  }
  const next = [...current];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return lineup;
  next.splice(toIndex, 0, moved);
  return { ...lineup, [role]: next };
}

export function getRoleSlotLimit(role: string): number {
  return ROLE_SLOT_LIMITS[role] ?? Number.POSITIVE_INFINITY;
}

export function getRoleDisplayName(role: string): string {
  if (role === "vocs") return "VOCS";
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
  roleOrder: string[],
): string[] {
  const errors: string[] = [];
  for (const role of roleOrder) {
    const selectedCount = countLineupEntries(lineup[role]);
    if (selectedCount > getRoleSlotLimit(role)) {
      errors.push(
        `${getRoleDisplayName(role)}: expected up to ${getRoleSlotLimit(role)} slot(s), selected ${selectedCount}.`,
      );
    }
  }
  return errors;
}

export function getUniqueSelectedMusicians(
  lineup: LineupMap,
  roleOrder: string[],
): string[] {
  const ids = new Set<string>();
  for (const role of roleOrder) {
    for (const id of normalizeLineupValue(
      lineup[role],
      getRoleSlotLimit(role),
    )) {
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
