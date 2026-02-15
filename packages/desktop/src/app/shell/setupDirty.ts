export type SetupInfoForm = {
  date: string;
  venue: string;
  bandRef: string;
};

export type GenericSetupForm = {
  bandRef: string;
  note: string;
  validityYear: string | number;
};

function normalizeText(value: string) {
  return value.trim();
}

function normalizeYear(value: string | number) {
  const normalized = String(value).trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && normalized !== "" ? String(numeric) : normalized;
}

export function isSetupInfoDirty(initial: SetupInfoForm, current: SetupInfoForm) {
  return (
    normalizeText(initial.date) !== normalizeText(current.date)
    || normalizeText(initial.venue) !== normalizeText(current.venue)
    || normalizeText(initial.bandRef) !== normalizeText(current.bandRef)
  );
}

export function isGenericSetupDirty(initial: GenericSetupForm, current: GenericSetupForm) {
  return (
    normalizeText(initial.bandRef) !== normalizeText(current.bandRef)
    || normalizeText(initial.note) !== normalizeText(current.note)
    || normalizeYear(initial.validityYear) !== normalizeYear(current.validityYear)
  );
}

export function shouldSaveGenericSetupOnContinue(editingProjectId: string | undefined, dirty: boolean) {
  return !editingProjectId || dirty;
}

export function resolveSetupBackTarget(
  editingProjectId: string | undefined,
  fromPath: string | null | undefined,
  origin: string | null | undefined,
) {
  if (editingProjectId && fromPath) return fromPath;
  if (editingProjectId && origin === "setup") return `/projects/${encodeURIComponent(editingProjectId)}/setup`;
  if (editingProjectId) return "/";
  return "/projects/new";
}

export function getSetupPrimaryCtaLabel(editingProjectId: string | undefined) {
  return editingProjectId ? "Back" : "Edit Project";
}
