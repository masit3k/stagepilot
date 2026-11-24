import {
  formatProjectDisplayName,
  formatProjectSlug,
} from "../../../projectRules";
import type { NewProjectPayload } from "../../shell/types";

export type ProjectInfoForm =
  | {
      purpose: "event";
      eventDate: string;
      eventVenue: string;
      documentDate: string;
    }
  | { purpose: "generic"; validityYear: string; note: string };

export type ProjectInfoBand = {
  id: string;
  code?: string | null;
  name: string;
};

/**
 * Fields the project info form owns, plus the ones derived from them (slug,
 * display name, timestamps). Everything else in a stored project belongs to
 * other screens and must pass through an edit untouched.
 */
function buildEditedFields(args: {
  id: string;
  band: ProjectInfoBand;
  form: ProjectInfoForm;
  nowIso: string;
}): Omit<NewProjectPayload, "createdAt"> {
  const { id, band, form, nowIso } = args;
  const stamps = { updatedAt: nowIso, contentUpdatedAt: nowIso };
  if (form.purpose === "event") {
    const namingSource = {
      purpose: "event" as const,
      eventDate: form.eventDate,
      eventVenue: form.eventVenue,
      documentDate: form.documentDate,
    };
    return {
      id,
      slug: formatProjectSlug(namingSource, band),
      displayName: formatProjectDisplayName(namingSource, band),
      purpose: "event",
      templateType: "event",
      eventDate: form.eventDate,
      eventVenue: form.eventVenue.trim(),
      bandRef: band.id,
      documentDate: form.documentDate,
      ...stamps,
    };
  }
  const documentDate = `${form.validityYear}-01-01`;
  const namingSource = {
    purpose: "generic" as const,
    documentDate,
    note: form.note,
  };
  const trimmedNote = form.note.trim();
  return {
    id,
    slug: formatProjectSlug(namingSource, band),
    displayName: formatProjectDisplayName(namingSource, band),
    purpose: "generic",
    templateType: "generic",
    bandRef: band.id,
    documentDate,
    ...(trimmedNote ? { note: trimmedNote } : {}),
    ...stamps,
  };
}

/**
 * The generic form edits the note, so a cleared note must not come back from
 * the stored project. The event form does not touch it.
 */
function withoutStoredNote(
  project: NewProjectPayload,
  form: ProjectInfoForm,
): NewProjectPayload {
  if (form.purpose !== "generic") return project;
  const { note: _storedNote, ...rest } = project;
  return rest;
}

/**
 * Builds the payload saved by the event and generic project info pages.
 *
 * Editing starts from the stored project and overwrites only what the form
 * edits, so `stageplan`, `inputOrder`, `notes` and any field this type does
 * not know survive. A new project has nothing to start from; lineup, overlays
 * and band leader are filled in afterwards from the band defaults.
 */
export function buildProjectInfoPayload(args: {
  existingProject: NewProjectPayload | null;
  id: string;
  band: ProjectInfoBand;
  form: ProjectInfoForm;
  nowIso: string;
}): NewProjectPayload {
  const { existingProject, nowIso } = args;
  const edited = buildEditedFields(args);
  if (!existingProject) {
    return {
      ...edited,
      status: "active",
      createdAt: nowIso,
      lineup: undefined,
      overlays: undefined,
      bandLeaderId: undefined,
    };
  }
  // Saving from this form has always written the project back as active and
  // without its archive or trash markers; the three go together so the stored
  // state stays consistent.
  const {
    archivedAt: _archivedAt,
    trashedAt: _trashedAt,
    purgeAt: _purgeAt,
    ...stored
  } = withoutStoredNote(existingProject, args.form);
  return {
    ...stored,
    ...edited,
    status: "active",
    createdAt: existingProject.createdAt ?? nowIso,
  };
}
