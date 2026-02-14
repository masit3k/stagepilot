import type { LineupMap, RoleConstraint, RoleLabelConstraints } from "../../projectRules";
import type { MusicianSetupPreset } from "../../../../../src/domain/model/types";

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
export type LibraryBandMember = { musicianId: string; roles: string[]; isDefault: boolean };
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
  constraints: Record<string, RoleConstraint>;
  roleConstraints?: RoleLabelConstraints;
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
  defaultContactId?: string | null;
  constraints: Record<string, RoleConstraint>;
  roleConstraints?: RoleLabelConstraints;
  defaultLineup?: LineupMap | null;
  members: Record<string, MemberOption[]>;
  musicianDefaults?: Record<string, Partial<MusicianSetupPreset>>;
  loadWarnings?: string[];
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
  templateType?: "event" | "generic";
  status?: "active" | "archived" | "trashed";
  archivedAt?: string;
  trashedAt?: string;
  purgeAt?: string;
  lineup?: LineupMap;
  bandLeaderId?: string;
  talkbackOwnerId?: string;
};

export type NavigationGuard = {
  isDirty: () => boolean;
  save: () => Promise<void>;
  discard?: () => void;
};

export function toPersistableProject(project: NewProjectPayload): NewProjectPayload {
  const {
    id, slug, displayName, purpose, eventDate, eventVenue, bandRef, documentDate, createdAt,
    updatedAt, templateType, status, archivedAt, trashedAt, purgeAt, lineup, bandLeaderId, talkbackOwnerId, note,
  } = project;

  return {
    id,
    slug,
    displayName,
    purpose,
    ...(eventDate ? { eventDate } : {}),
    ...(eventVenue ? { eventVenue } : {}),
    bandRef,
    documentDate,
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
    ...(templateType ? { templateType } : {}),
    ...(status ? { status } : {}),
    ...(archivedAt ? { archivedAt } : {}),
    ...(trashedAt ? { trashedAt } : {}),
    ...(purgeAt ? { purgeAt } : {}),
    ...(lineup ? { lineup } : {}),
    ...(bandLeaderId ? { bandLeaderId } : {}),
    ...(talkbackOwnerId ? { talkbackOwnerId } : {}),
    ...(note ? { note } : {}),
  };
}
