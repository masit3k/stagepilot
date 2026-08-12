import type { LineupMap } from "../../projectRules";
import { serializeLineupForProject, CANONICAL_LINEUP_ROLE_ORDER } from "./lineupSerialize";
import type {
  MusicianSetupPreset,
  PresetEntity,
  PresetItem,
} from "../../../../../src/domain/model/types";

export type ProjectSummary = {
  id: string;
  slug?: string | null;
  displayName?: string | null;
  bandRef?: string | null;
  eventDate?: string | null;
  eventVenue?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  templateType?: "event" | "generic" | null;
  status?: "active" | "archived" | "trashed" | null;
  archivedAt?: string | null;
  trashedAt?: string | null;
  purgeAt?: string | null;
  purpose?: "event" | "generic" | null;
};

export type BandOption = { id: string; name: string; code?: string | null };
export type MemberOption = { id: string; name: string };
export type LibraryBandMember = {
  musicianId: string;
  roles: string[];
  isDefault: boolean;
};
export type LibraryContact = {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  note?: string;
  primary?: boolean;
};
export type LibraryMessage = { id: string; name: string; body: string };
export type LibraryBand = {
  id: string;
  name: string;
  code: string;
  description?: string;
  defaultLineup?: LineupMap | null;
  members: LibraryBandMember[];
  contacts: LibraryContact[];
  messages: LibraryMessage[];
};
export type LibraryMusician = {
  id: string;
  name: string;
  gender?: string;
  defaultRoles: string[];
  notes?: string;
};
export type BandSetupData = {
  id: string;
  name: string;
  bandLeader?: string | null;
  bandLeaderId?: string | null;
  defaultTalkbackOwnerId?: string | null;
  defaultContactId?: string | null;
  defaultLineup?: LineupMap | null;
  defaultOverlays?: {
    leadVocals?: string[] | null;
    backVocals?: string[] | null;
  } | null;
  members: Record<string, MemberOption[]>;
  musicianDefaults?: Record<string, Partial<MusicianSetupPreset>>;
  musicianPresetsById?: Record<string, PresetItem[]>;
  loadWarnings?: string[];
  presetCatalog?: Record<string, PresetEntity>;
};

export type NewProjectPayload = {
  id: string;
  slug?: string;
  displayName?: string;
  purpose: "event" | "generic";
  bandRef: string;
  documentDate: string;
  eventDate?: string;
  eventVenue?: string;
  note?: string;
  createdAt: string;
  updatedAt?: string;
  contentUpdatedAt?: string;
  templateType?: "event" | "generic";
  status?: "active" | "archived" | "trashed";
  archivedAt?: string;
  trashedAt?: string;
  purgeAt?: string;
  lineup?: LineupMap;
  overlays?: {
    leadVocals?: string[];
    backVocals?: string[];
    talkback?: { mode: "none"; ownerId: null } | { mode: "assigned"; ownerId: string };
  };
  bandLeaderId?: string;
  talkbackOwnerId?: string;
  talkbackOverride?:
    | { mode: "none" }
    | { mode: "assigned"; musicianId: string };
  hasTalkbackOverride?: boolean;
};

export type NavigationGuard = {
  isDirty: () => boolean;
  save: () => Promise<void>;
  discard?: () => void;
};

export function toPersistableProject(
  project: NewProjectPayload,
): NewProjectPayload {
  const {
    id,
    slug,
    displayName,
    purpose,
    eventDate,
    eventVenue,
    bandRef,
    documentDate,
    createdAt,
    updatedAt,
    contentUpdatedAt,
    templateType,
    status,
    archivedAt,
    trashedAt,
    purgeAt,
    lineup,
    overlays,
    bandLeaderId,
    note,
  } = project;
  const serializedLineup = lineup
    ? serializeLineupForProject(lineup, [...CANONICAL_LINEUP_ROLE_ORDER])
    : undefined;
  const trimmedNote = note?.trim();

  return {
    id,
    slug,
    displayName,
    purpose,
    ...(purpose === "generic" && trimmedNote ? { note: trimmedNote } : {}),
    ...(eventDate ? { eventDate } : {}),
    ...(eventVenue ? { eventVenue } : {}),
    bandRef,
    documentDate,
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
    ...(contentUpdatedAt ? { contentUpdatedAt } : {}),
    ...(templateType ? { templateType } : {}),
    ...(status ? { status } : {}),
    ...(archivedAt ? { archivedAt } : {}),
    ...(trashedAt ? { trashedAt } : {}),
    ...(purgeAt ? { purgeAt } : {}),
    ...(serializedLineup ? { lineup: serializedLineup } : {}),
    ...(overlays ? { overlays } : {}),
    ...(bandLeaderId ? { bandLeaderId } : {}),
  };
}
