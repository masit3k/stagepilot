import { invoke } from "@tauri-apps/api/core";
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";
import { LibraryHomePage, SettingsPage, TopTabs } from "../../pages/ShellPages";
import stagePilotIcon from "../../../assets/icons/StagePilot_Icon_StageLayout_CurrentColor.svg";
import desktopPackage from "../../../package.json";
import {
  type LineupMap,
  type LineupSlotValue,
  type PresetOverridePatch,
  type RoleConstraint,
  type RoleLabelConstraints,
  buildExportFileName,
  acceptISOToDDMMYYYY,
  formatProjectDisplayName,
  formatProjectSlug,
  formatDateDigitsToDDMMYYYY,
  formatIsoDateToUs,
  formatIsoToDateTimeDisplay,
  getTodayIsoLocal,
  getUniqueSelectedMusicians,
  getRoleDisplayName,
  isPastIsoDate,
  matchLibraryBandDetailPath,
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  normalizeLineupSlots,
  normalizeLineupValue,
  normalizeRoleConstraint,
  parseDDMMYYYYToISO,
  parseUsDateInput,
  resolveBandLeaderId,
  resolveTalkbackOwnerId,
  validateLineup,
} from "../../projectRules";
import { generateUuidV7, isUuidV7 } from "../../../../../src/domain/projectNaming";
import {
  validateEffectivePresets,
} from "../../../../../src/domain/rules/presetOverride";
import type { Group } from "../../../../../src/domain/model/groups";
import type { InputChannel, MusicianSetupPreset, PresetOverridePatch as DomainPresetOverridePatch } from "../../../../../src/domain/model/types";
import { resolveEffectiveMusicianSetup } from "../../../../../src/domain/setup/resolveEffectiveMusicianSetup";
import { inferDrumSetupFromLegacyInputs, STANDARD_10_SETUP } from "../../../../../src/domain/drums/drumSetup";
import { resolveDrumInputs } from "../../../../../src/domain/drums/resolveDrumInputs";
import { MusicianSelector, type SetupMusicianItem } from "../../components/setup/MusicianSelector";
import { SelectedInputsList } from "../../components/setup/SelectedInputsList";
import { DrumsPartsEditor } from "../../components/setup/DrumsPartsEditor";
import { MonitoringEditor } from "../../components/setup/MonitoringEditor";

type ProjectSummary = {
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
type BandOption = { id: string; name: string; code?: string | null };
type MemberOption = { id: string; name: string };
type LibraryBandMember = { musicianId: string; roles: string[]; isDefault: boolean };
type LibraryContact = {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  note?: string;
  primary?: boolean;
};
type LibraryMessage = { id: string; name: string; body: string };
type LibraryBand = {
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
type LibraryMusician = {
  id: string;
  name: string;
  gender?: string;
  defaultRoles: string[];
  notes?: string;
};
type BandSetupData = {
  id: string;
  name: string;
  bandLeader?: string | null;
  defaultContactId?: string | null;
  constraints: Record<string, RoleConstraint>;
  roleConstraints?: RoleLabelConstraints;
  defaultLineup?: LineupMap | null;
  members: Record<string, MemberOption[]>;
  loadWarnings?: string[];
};

function createFallbackSetupData(project: NewProjectPayload): BandSetupData {
  const constraints = Object.fromEntries(
    ROLE_ORDER.map((role) => [role, { min: 0, max: 1 }]),
  ) as Record<string, RoleConstraint>;
  return {
    id: project.bandRef,
    name: project.displayName || project.bandRef,
    constraints,
    defaultLineup: {},
    members: Object.fromEntries(
      [...ROLE_ORDER, "talkback"].map((role) => [role, []]),
    ) as Record<string, MemberOption[]>,
  };
}
type NewProjectPayload = {
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
type ApiError = { message?: string };

function toPersistableProject(project: NewProjectPayload): NewProjectPayload {
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
    templateType,
    status,
    archivedAt,
    trashedAt,
    purgeAt,
    lineup,
    bandLeaderId,
    talkbackOwnerId,
    note,
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

type PreviewState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "ready"; path: string }
  | { kind: "error"; message: string; missingPreview: boolean };

type ExportModalState =
  | { kind: "success"; path: string }
  | { kind: "error"; message: string; technical?: string }
  | null;

type NavigationGuard = {
  isDirty: () => boolean;
  save: () => Promise<void>;
  discard?: () => void;
};

const ROLE_ORDER = ["drums", "bass", "guitar", "keys", "vocs"];

const GROUP_INPUT_LIBRARY: Record<Group, InputChannel[]> = {
  drums: resolveDrumInputs(STANDARD_10_SETUP),
  bass: [{ key: "bass_di", label: "Bass DI", group: "bass" }],
  guitar: [
    { key: "gtr_mic", label: "Guitar Mic", group: "guitar" },
    { key: "gtr_di", label: "Guitar DI", group: "guitar" },
  ],
  keys: [
    { key: "keys_l", label: "Keys L", group: "keys" },
    { key: "keys_r", label: "Keys R", group: "keys" },
  ],
  vocs: [
    { key: "voc_lead", label: "Lead Vocal", group: "vocs" },
    { key: "voc_back", label: "Back Vocal", group: "vocs" },
  ],
  talkback: [{ key: "talkback", label: "Talkback", group: "talkback" }],
};


function getGroupDefaultPreset(group: Group): MusicianSetupPreset {
  return {
    inputs: (GROUP_INPUT_LIBRARY[group] ?? []).map((item) => ({ ...item })),
    monitoring: {
      type: "wedge",
      mode: "mono",
      mixCount: 1,
    },
  };
}

function buildInputsPatchFromTarget(defaultInputs: InputChannel[], targetInputs: InputChannel[]): NonNullable<DomainPresetOverridePatch["inputs"]> {
  const defaultByKey = new Map(defaultInputs.map((item) => [item.key, item]));
  const targetByKey = new Map(targetInputs.map((item) => [item.key, item]));
  const removeKeys = defaultInputs.filter((item) => !targetByKey.has(item.key)).map((item) => item.key);
  const add = targetInputs.filter((item) => !defaultByKey.has(item.key));
  return {
    ...(add.length > 0 ? { add } : {}),
    ...(removeKeys.length > 0 ? { removeKeys } : {}),
  };
}
function formatProjectDate(project: ProjectSummary) {
  if (project.updatedAt) return formatIsoToDateTimeDisplay(project.updatedAt);
  if (project.eventDate) return `${formatIsoDateToUs(project.eventDate)} 00:00`;
  if (project.createdAt) return formatIsoToDateTimeDisplay(project.createdAt);
  return "—";
}

function getProjectPurposeLabel(purpose?: string | null) {
  if (purpose === "event") return "Project type: Event";
  if (purpose === "generic") return "Project type: Generic";
  return "—";
}

function isSetupInfoDirty(
  initial: { date: string; venue: string; bandRef: string },
  current: { date: string; venue: string; bandRef: string },
) {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

function getCurrentPath() {
  return window.location.pathname || "/";
}

function toIdSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

function withFrom(path: string, from: string, fromPath?: string) {
  const params = new URLSearchParams({ from });
  if (fromPath) params.set("fromPath", fromPath);
  return `${path}?${params.toString()}`;
}

function getNavigationContextLabel(origin?: string | null) {
  if (origin === "home") return "Project Hub";
  if (origin === "setup") return "Lineup Setup";
  if (origin === "preview") return "PDF Preview";
  if (origin === "pdfPreview") return "PDF Preview";
  return null;
}

function AppShell() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [bands, setBands] = useState<BandOption[]>([]);
  const [status, setStatus] = useState("");
  const [pathname, setPathname] = useState(getCurrentPath());
  const [search, setSearch] = useState(window.location.search || "");
  const pathnameRef = useRef(pathname);
  const guardRef = useRef<NavigationGuard | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const registerNavigationGuard = useCallback(
    (guard: NavigationGuard | null) => {
      guardRef.current = guard;
    },
    [],
  );

  const navigateImmediate = useCallback((path: string, replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setPathname(window.location.pathname);
    setSearch(window.location.search || "");
  }, []);

  const navigate = useCallback(
    (path: string) => {
      if (path === pathnameRef.current) return;
      const guard = guardRef.current;
      if (guard?.isDirty()) {
        setPendingNavigation(path);
        return;
      }
      navigateImmediate(path);
    },
    [navigateImmediate],
  );

  useEffect(() => {
    const h = () => {
      const targetPath = getCurrentPath();
      const guard = guardRef.current;
      if (guard?.isDirty()) {
        window.history.pushState({}, "", pathnameRef.current);
        setPendingNavigation(targetPath);
        return;
      }
      setPathname(targetPath);
      setSearch(window.location.search || "");
    };
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);

  const refreshProjects = useCallback(async () => {
    const availableBands = await invoke<BandOption[]>("list_bands");
    const bandsById = new Map(availableBands.map((band) => [band.id, band]));
    const bandsByCode = new Map(
      availableBands
        .filter((band) => Boolean(band.code?.trim()))
        .map((band) => [band.code?.trim().toLowerCase() ?? "", band]),
    );
    const listed = await invoke<ProjectSummary[]>("list_projects");
    const migratedIds = new Map<string, string>();
    const maintainedProjects: ProjectSummary[] = [];
    const now = new Date();
    const nowIso = now.toISOString();
    const todayIso = getTodayIsoLocal(now);

    for (const summary of listed) {
      const raw = await invoke<string>("read_project", { projectId: summary.id });
      const parsedRaw = JSON.parse(raw) as NewProjectPayload & Record<string, unknown>;
      const { legacyId: _legacyId, ...withoutLegacy } = parsedRaw as NewProjectPayload & {
        legacyId?: unknown;
      };
      const project = withoutLegacy as NewProjectPayload;

      if (project.status === "trashed" && project.purgeAt && new Date(project.purgeAt).getTime() < now.getTime()) {
        await invoke("delete_project_permanently", { projectId: project.id });
        continue;
      }

      const templateType = project.templateType ?? project.purpose;
      const needsTemplateTypeMigration = project.templateType !== templateType;
      const needsIdMigration = !isUuidV7(project.id);
      const normalizedBandRef = project.bandRef?.trim() || "";
      const band =
        bandsById.get(normalizedBandRef) ||
        bandsByCode.get(normalizedBandRef.toLowerCase());
      if (!band) continue;

      const canonicalBandRef = band.id;
      const needsBandRefMigration = canonicalBandRef !== project.bandRef;
      const namingSource = {
        purpose: project.purpose,
        eventDate: project.eventDate,
        eventVenue: project.eventVenue,
        documentDate: project.documentDate,
        note: project.note,
      };
      const slug = formatProjectSlug(namingSource, band);
      const displayName = formatProjectDisplayName(namingSource, band);
      const needsNameMigration = project.slug !== slug || project.displayName !== displayName;
      const hasLegacyId = Object.prototype.hasOwnProperty.call(parsedRaw, "legacyId");
      const currentStatus = project.status ?? "active";
      const eventDate = project.eventDate;
      const shouldAutoArchive =
        templateType === "event" &&
        currentStatus === "active" &&
        Boolean(eventDate) &&
        isPastIsoDate(eventDate ?? "", todayIso);

      const needsMaintenance =
        shouldAutoArchive ||
        hasLegacyId ||
        needsIdMigration ||
        needsBandRefMigration ||
        needsNameMigration ||
        needsTemplateTypeMigration ||
        !project.status;

      const legacyId = summary.id;
      const nextId = needsIdMigration ? generateUuidV7() : project.id;
      const migrated: NewProjectPayload = {
        ...(project as Omit<NewProjectPayload, "id" | "slug" | "displayName" | "bandRef">),
        id: nextId,
        slug,
        displayName,
        bandRef: canonicalBandRef,
        templateType: templateType ?? "generic",
        status: shouldAutoArchive ? "archived" : currentStatus,
        archivedAt: shouldAutoArchive ? nowIso : project.archivedAt,
        updatedAt: needsMaintenance ? nowIso : project.updatedAt,
      };

      if (needsMaintenance) {
        await invoke("save_project", {
          projectId: nextId,
          legacyProjectId: legacyId,
          json: JSON.stringify(toPersistableProject(migrated), null, 2),
        });
        if (legacyId !== nextId) migratedIds.set(legacyId, nextId);
      }

      maintainedProjects.push({
        ...summary,
        id: nextId,
        slug: migrated.slug,
        displayName: migrated.displayName,
        bandRef: migrated.bandRef,
        purpose: migrated.purpose,
        templateType: migrated.templateType,
        status: migrated.status,
        eventDate: migrated.eventDate,
        updatedAt: migrated.updatedAt ?? summary.updatedAt,
        archivedAt: migrated.archivedAt,
        trashedAt: migrated.trashedAt,
        purgeAt: migrated.purgeAt,
      });
    }

    setProjects(maintainedProjects);
    const activePath = window.location.pathname;
    const match = activePath.match(/^\/projects\/([^/]+)/);
    if (match) {
      const activeId = decodeURIComponent(match[1]);
      const migratedId = migratedIds.get(activeId);
      if (migratedId) {
        const rerouted = activePath.replace(
          `/projects/${encodeURIComponent(activeId)}`,
          `/projects/${encodeURIComponent(migratedId)}`,
        );
        navigateImmediate(`${rerouted}${window.location.search || ""}`, true);
      }
    }
  }, [navigateImmediate]);

  const refreshBands = useCallback(async () => {
    setBands(await invoke<BandOption[]>("list_bands"));
  }, []);

  const updateProjectLifecycle = useCallback(async (projectId: string, updater: (project: NewProjectPayload, now: Date) => NewProjectPayload) => {
    const raw = await invoke<string>("read_project", { projectId });
    const project = JSON.parse(raw) as NewProjectPayload;
    const now = new Date();
    const updatedProject = updater(project, now);
    await invoke("save_project", {
      projectId,
      json: JSON.stringify(toPersistableProject(updatedProject), null, 2),
    });
    await refreshProjects();
  }, [refreshProjects]);

  const archiveProject = useCallback(async (project: ProjectSummary) => {
    await updateProjectLifecycle(project.id, (source, now) => ({
      ...source,
      templateType: source.templateType ?? source.purpose,
      status: "archived",
      archivedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }));
    setStatus("Project archived.");
  }, [updateProjectLifecycle]);

  const unarchiveProject = useCallback(async (project: ProjectSummary) => {
    await updateProjectLifecycle(project.id, (source, now) => ({
      ...source,
      templateType: source.templateType ?? source.purpose,
      status: "active",
      updatedAt: now.toISOString(),
    }));
    setStatus("Project moved to Active.");
  }, [updateProjectLifecycle]);

  const moveProjectToTrash = useCallback(async (project: ProjectSummary) => {
    await updateProjectLifecycle(project.id, (source, now) => {
      const purgeAt = new Date(now);
      purgeAt.setDate(purgeAt.getDate() + 30);
      return {
        ...source,
        templateType: source.templateType ?? source.purpose,
        status: "trashed",
        trashedAt: now.toISOString(),
        purgeAt: purgeAt.toISOString(),
        updatedAt: now.toISOString(),
      };
    });
    setStatus("Project moved to Trash.");
  }, [updateProjectLifecycle]);

  const restoreProject = useCallback(async (project: ProjectSummary) => {
    await updateProjectLifecycle(project.id, (source, now) => {
      const todayIso = getTodayIsoLocal(now);
      const templateType = source.templateType ?? source.purpose;
      const restoreStatus =
        templateType === "event" && source.eventDate && isPastIsoDate(source.eventDate, todayIso)
          ? "archived"
          : "active";
      return {
        ...source,
        templateType,
        status: restoreStatus,
        trashedAt: undefined,
        purgeAt: undefined,
        updatedAt: now.toISOString(),
      };
    });
    setStatus("Project restored.");
  }, [updateProjectLifecycle]);

  const deleteProjectPermanently = useCallback(async (project: ProjectSummary) => {
    await invoke("delete_project_permanently", { projectId: project.id });
    await refreshProjects();
    setStatus("Project permanently deleted.");
  }, [refreshProjects]);

  useEffect(() => {
    (async () => {
      await Promise.all([refreshProjects(), refreshBands()]);
    })().catch(() => setStatus("Failed to load initial data."));
  }, [refreshBands, refreshProjects]);

  const setupProjectId = useMemo(
    () => matchProjectSetupPath(pathname),
    [pathname],
  );
  const previewProjectId = useMemo(
    () => matchProjectPreviewPath(pathname),
    [pathname],
  );
  const eventEditProjectId = useMemo(
    () => matchProjectEventPath(pathname),
    [pathname],
  );
  const genericEditProjectId = useMemo(
    () => matchProjectGenericPath(pathname),
    [pathname],
  );
  const libraryBandDetailId = useMemo(
    () => matchLibraryBandDetailPath(pathname),
    [pathname],
  );

  const editOrigin = useMemo(
    () => new URLSearchParams(search).get("from"),
    [search],
  );
  const editFromPath = useMemo(
    () => new URLSearchParams(search).get("fromPath"),
    [search],
  );
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__icon-slot" aria-hidden="true">
            <img src={stagePilotIcon} className="app-header__icon" alt="" />
          </div>
          <div>
            <h1>StagePilot</h1>
            <p className="subtle">
              StagePilot v{desktopPackage.version} (Preview)
            </p>
          </div>
        </div>
        <button
          type="button"
          className="button-secondary app-header__about-button"
          onClick={() => setIsAboutOpen(true)}
          aria-label="About StagePilot"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="app-header__about-icon">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </header>
      <TopTabs pathname={pathname} navigate={navigate} />
      {status ? <p className="status status--error">{status}</p> : null}
      {pathname === "/" ? (
        <StartPage projects={projects} navigate={navigate} onArchiveProject={archiveProject} onUnarchiveProject={unarchiveProject} onMoveProjectToTrash={moveProjectToTrash} onRestoreProject={restoreProject} onDeleteProjectPermanently={deleteProjectPermanently} />
      ) : null}
      {pathname === "/projects/new" ? (
        <ChooseProjectTypePage navigate={navigate} />
      ) : null}
      {pathname === "/projects/new/event" ? (
        <NewEventProjectPage
          bands={bands}
          navigate={navigate}
          onCreated={refreshProjects}
          registerNavigationGuard={registerNavigationGuard}
        />
      ) : null}
      {pathname === "/projects/new/generic" ? (
        <NewGenericProjectPage
          bands={bands}
          navigate={navigate}
          onCreated={refreshProjects}
          registerNavigationGuard={registerNavigationGuard}
        />
      ) : null}
      {eventEditProjectId ? (
        <NewEventProjectPage
          bands={bands}
          navigate={navigate}
          onCreated={refreshProjects}
          editingProjectId={eventEditProjectId}
          registerNavigationGuard={registerNavigationGuard}
          origin={editOrigin}
          fromPath={editFromPath}
        />
      ) : null}
      {genericEditProjectId ? (
        <NewGenericProjectPage
          bands={bands}
          navigate={navigate}
          onCreated={refreshProjects}
          editingProjectId={genericEditProjectId}
          registerNavigationGuard={registerNavigationGuard}
          origin={editOrigin}
          fromPath={editFromPath}
        />
      ) : null}
      {setupProjectId ? (
        <ProjectSetupPage
          id={setupProjectId}
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
          search={search}
        />
      ) : null}
      {previewProjectId ? (
        <ProjectPreviewPage
          id={previewProjectId}
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
          search={search}
        />
      ) : null}
      {pathname === "/library" ? (
        <LibraryHomePage navigate={navigate} />
      ) : null}
      {pathname === "/library/bands" ? (
        <LibraryBandsPage
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
        />
      ) : null}
      {libraryBandDetailId ? (
        <LibraryBandDetailPage
          bandId={libraryBandDetailId}
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
        />
      ) : null}
      {pathname === "/library/musicians" ? (
        <LibraryMusiciansPage
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
        />
      ) : null}
      {pathname === "/library/instruments" ? (
        <LibraryInstrumentsPage
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
        />
      ) : null}
      {pathname === "/library/contacts" ? (
        <LibraryContactsPage
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
        />
      ) : null}
      {pathname === "/library/messages" ? (
        <LibraryMessagesPage
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
        />
      ) : null}
      {pathname === "/settings" ? <SettingsPage /> : null}
      <AboutModal open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <UnsavedChangesModal
        open={Boolean(pendingNavigation)}
        onStay={() => setPendingNavigation(null)}
        onExitWithoutSaving={() => {
          guardRef.current?.discard?.();
          const path = pendingNavigation;
          setPendingNavigation(null);
          if (path) navigateImmediate(path);
        }}
        onSaveAndExit={async () => {
          await guardRef.current?.save();
          const path = pendingNavigation;
          setPendingNavigation(null);
          if (path) navigateImmediate(path);
        }}
      />
    </main>
  );
}

type ProjectStatusTab = "active" | "archived" | "trashed";

type StartPageProps = {
  projects: ProjectSummary[];
  navigate: (path: string) => void;
  onArchiveProject: (project: ProjectSummary) => Promise<void>;
  onUnarchiveProject: (project: ProjectSummary) => Promise<void>;
  onMoveProjectToTrash: (project: ProjectSummary) => Promise<void>;
  onRestoreProject: (project: ProjectSummary) => Promise<void>;
  onDeleteProjectPermanently: (project: ProjectSummary) => Promise<void>;
};
function StartPage({
  projects,
  navigate,
  onArchiveProject,
  onUnarchiveProject,
  onMoveProjectToTrash,
  onRestoreProject,
  onDeleteProjectPermanently,
}: StartPageProps) {
  const [viewMode, setViewMode] = useState<"list" | "tiles">(() =>
    localStorage.getItem("project-hub-view") === "tiles" ? "tiles" : "list",
  );
  const [activeTab, setActiveTab] = useState<ProjectStatusTab>("active");
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<
    | { kind: "trash"; project: ProjectSummary }
    | { kind: "archive"; project: ProjectSummary }
    | { kind: "unarchive"; project: ProjectSummary }
    | { kind: "deletePermanent"; project: ProjectSummary }
    | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmDialogRef = useModalBehavior(Boolean(modalState), () => setModalState(null));

  useEffect(() => {
    localStorage.setItem("project-hub-view", viewMode);
  }, [viewMode]);

  const sortedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.updatedAt ?? a.createdAt ?? 0).getTime(),
      ),
    [projects],
  );
  const projectsByTab = useMemo(
    () => ({
      active: sortedProjects.filter((project) => (project.status ?? "active") === "active"),
      archived: sortedProjects.filter((project) => project.status === "archived"),
      trashed: sortedProjects.filter((project) => project.status === "trashed"),
    }),
    [sortedProjects],
  );

  const visibleProjects = projectsByTab[activeTab];

  function projectEditPath(project: ProjectSummary) {
    const encodedId = encodeURIComponent(project.id);
    const templateType = project.templateType ?? project.purpose ?? "generic";
    const route = templateType === "event" ? `/projects/${encodedId}/event` : `/projects/${encodedId}/generic`;
    return `${route}?from=home`;
  }

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".project-context-menu-shell") || target.closest(".project-context-menu")) return;
      setOpenMenuProjectId(null);
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenuProjectId(null);
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, []);

  async function confirmModalAction() {
    if (!modalState || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (modalState.kind === "trash") await onMoveProjectToTrash(modalState.project);
      if (modalState.kind === "archive") await onArchiveProject(modalState.project);
      if (modalState.kind === "unarchive") await onUnarchiveProject(modalState.project);
      if (modalState.kind === "deletePermanent") {
        await onDeleteProjectPermanently(modalState.project);
      }
      setModalState(null);
      setOpenMenuProjectId(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  function restoreProject(project: ProjectSummary) {
    onRestoreProject(project).catch(() => undefined);
    setOpenMenuProjectId(null);
  }

  function buildMenuItems(project: ProjectSummary) {
    const status = project.status ?? "active";
    if (status === "active") {
      return [
        {
          label: "Edit",
          onClick: () => navigate(projectEditPath(project)),
          danger: false,
        },
        {
          label: "Preview",
          onClick: () =>
            navigate(
              withFrom(`/projects/${encodeURIComponent(project.id)}/preview`, "home"),
            ),
          danger: false,
        },
        {
          label: "Archive",
          onClick: () => setModalState({ kind: "archive", project }),
          danger: false,
        },
        {
          label: "Delete",
          onClick: () => setModalState({ kind: "trash", project }),
          danger: true,
        },
      ];
    }

    if (status === "archived") {
      return [
        {
          label: "Preview",
          onClick: () =>
            navigate(
              withFrom(`/projects/${encodeURIComponent(project.id)}/preview`, "home"),
            ),
          danger: false,
        },
        {
          label: "Unarchive",
          onClick: () => setModalState({ kind: "unarchive", project }),
          danger: false,
        },
        {
          label: "Delete",
          onClick: () => setModalState({ kind: "trash", project }),
          danger: true,
        },
      ];
    }

    return [
      {
        label: "Restore",
        onClick: () => restoreProject(project),
        danger: false,
      },
      {
        label: "Delete permanently",
        onClick: () => setModalState({ kind: "deletePermanent", project }),
        danger: true,
      },
    ];
  }

  function renderProjectCard(project: ProjectSummary) {
    const isMenuOpen = openMenuProjectId === project.id;
    const projectLabel = project.displayName || project.slug || project.id;

    const onCardClick = () => {
      if (activeTab === "active") {
        navigate(projectEditPath(project));
        return;
      }
      if (activeTab === "archived") {
        navigate(withFrom(`/projects/${encodeURIComponent(project.id)}/preview`, "home"));
      }
    };

    const onCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (activeTab === "trashed") return;
      onCardClick();
    };

    const cardMenu = isMenuOpen ? (
      <ProjectContextMenuPortal
        project={project}
        projectLabel={projectLabel}
        onClose={() => setOpenMenuProjectId(null)}
      >
        {buildMenuItems(project).map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={item.danger ? "project-context-menu__item project-context-menu__item--danger" : "project-context-menu__item"}
            onClick={(event) => {
              event.stopPropagation();
              setOpenMenuProjectId(null);
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ))}
      </ProjectContextMenuPortal>
    ) : null;

    return (
      <article
        key={project.id}
        className={
          viewMode === "list"
            ? "project-card project-card--list project-surface"
            : "project-card project-surface"
        }
        role={activeTab === "trashed" ? undefined : "button"}
        tabIndex={activeTab === "trashed" ? -1 : 0}
        onClick={onCardClick}
        onKeyDown={onCardKeyDown}
        aria-label={activeTab === "archived" ? `Preview ${projectLabel}` : `Edit ${projectLabel}`}
      >
        <div className="project-main-action__content">
          <strong>{projectLabel}</strong>
          <span>{getProjectPurposeLabel(project.templateType ?? project.purpose)}</span>
          <span>Last updated: {formatProjectDate(project)}</span>
          {activeTab === "trashed" && project.purgeAt ? (
            <span>Scheduled for deletion on: {formatIsoToDateTimeDisplay(project.purgeAt)}</span>
          ) : null}
        </div>
        <div className="project-context-menu-shell">
          <button
            type="button"
            className="project-kebab"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls={isMenuOpen ? `project-menu-${project.id}` : undefined}
            aria-label={`Open actions for ${projectLabel}`}
            onClick={(event) => {
              event.stopPropagation();
              setOpenMenuProjectId((current) => (current === project.id ? null : project.id));
            }}
          >
            ⋯
          </button>
          {cardMenu}
        </div>
      </article>
    );
  }

  function getEmptyStateCopy(tab: ProjectStatusTab) {
    if (tab === "active") return "No active projects.";
    if (tab === "archived") return "No archived projects.";
    return "Trash is empty.";
  }

  return (
    <section className="panel">
      <div className="panel__header panel__header--hub">
        <h2>Project Hub</h2>
      </div>
      <div className="actions-row actions-row--top">
        <button
          type="button"
          className="button-primary button-primary--large"
          onClick={() => navigate("/projects/new")}
        >
          + New Project
        </button>
        <div className="view-toggle" role="group" aria-label="Project layout">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            className={
              viewMode === "list"
                ? "button-secondary view-toggle__icon is-active"
                : "button-secondary view-toggle__icon"
            }
            onClick={() => setViewMode("list")}
          >
            ≣
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={viewMode === "tiles"}
            className={
              viewMode === "tiles"
                ? "button-secondary view-toggle__icon is-active"
                : "button-secondary view-toggle__icon"
            }
            onClick={() => setViewMode("tiles")}
          >
            ⊞
          </button>
        </div>
      </div>
      <div className="hub-tabs" role="tablist" aria-label="Project status tabs">
        {(["active", "archived", "trashed"] as ProjectStatusTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "button-secondary is-active" : "button-secondary"}
            onClick={() => {
              setActiveTab(tab);
              setOpenMenuProjectId(null);
            }}
          >
            {tab === "active" ? "Active" : tab === "archived" ? "Archived" : "Trash"}
          </button>
        ))}
      </div>
      {visibleProjects.length === 0 ? (
        <p className="subtle">{getEmptyStateCopy(activeTab)}</p>
      ) : (
        <div className="project-sections">
          <section className="project-section">
            <div className={viewMode === "list" ? "project-list project-list--rows" : "project-list"}>
              {visibleProjects.map(renderProjectCard)}
            </div>
          </section>
        </div>
      )}
      <ModalOverlay open={Boolean(modalState)} onClose={() => setModalState(null)}>
        <div
          className="selector-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="project-action-title"
          aria-describedby="project-action-body"
          ref={confirmDialogRef}
        >
          <h3 id="project-action-title">
            {modalState?.kind === "trash"
              ? "Delete project?"
              : modalState?.kind === "archive"
                ? "Archive project?"
                : modalState?.kind === "unarchive"
                  ? "Unarchive project?"
                  : "Delete permanently?"}
          </h3>
          <p id="project-action-body">
            {modalState?.kind === "trash"
              ? "This will move the project to Trash. It will be permanently deleted after 30 days."
              : modalState?.kind === "archive"
                ? "You can restore it anytime from Archived."
                : modalState?.kind === "unarchive"
                  ? "The project will return to Active."
                  : "This action cannot be undone."}
          </p>
          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={() => setModalState(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={modalState?.kind === "archive" || modalState?.kind === "unarchive" ? "button-primary" : "button-danger"}
              onClick={confirmModalAction}
              disabled={isSubmitting}
            >
              {modalState?.kind === "trash"
                ? "Delete"
                : modalState?.kind === "archive"
                  ? "Archive"
                  : modalState?.kind === "unarchive"
                    ? "Unarchive"
                    : "Delete permanently"}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </section>
  );
}

function ProjectContextMenuPortal({
  project,
  projectLabel,
  onClose,
  children,
}: {
  project: ProjectSummary;
  projectLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const anchor = document.querySelector<HTMLButtonElement>(
      `[aria-controls="project-menu-${project.id}"]`,
    );
    anchorRef.current = anchor;

    const margin = 8;
    const offset = 6;
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    const update = () => {
      const anchorRect = anchorRef.current?.getBoundingClientRect();
      const menuRect = menuRef.current?.getBoundingClientRect();
      if (!anchorRect || !menuRect) return;

      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      const maxLeft = Math.max(margin, viewportW - menuRect.width - margin);
      const maxTop = Math.max(margin, viewportH - menuRect.height - margin);

      let top = anchorRect.bottom + offset;
      let left = anchorRect.right - menuRect.width;

      if (top + menuRect.height + margin > viewportH) {
        top = anchorRect.top - offset - menuRect.height;
      }

      top = clamp(top, margin, maxTop);
      left = clamp(left, margin, maxLeft);
      setPosition({ top, left });
    };

    const frameId = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [project.id]);

  return createPortal(
    <div
      id={`project-menu-${project.id}`}
      ref={menuRef}
      className="project-context-menu"
      style={{ position: "fixed", top: position.top, left: position.left, zIndex: 2000 }}
      role="menu"
      aria-label={`Project actions for ${projectLabel}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function ChooseProjectTypePage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  return (
    <section className="panel panel--choice">
      <div className="panel__header">
        <h2>New Project</h2>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
        >
          Back to Hub
        </button>
      </div>
      <div className="choice-grid" aria-label="Project type options">
        <button
          type="button"
          className="choice-card"
          onClick={() => navigate("/projects/new/event")}
        >
          <span className="choice-card__check" aria-hidden="true">
            ✓
          </span>
          <span className="choice-card__title">Event Project</span>
          <span className="choice-card__desc">
            For a specific show with date and venue.
          </span>
        </button>
        <button
          type="button"
          className="choice-card"
          onClick={() => navigate("/projects/new/generic")}
        >
          <span className="choice-card__check" aria-hidden="true">
            ✓
          </span>
          <span className="choice-card__title">Generic Template</span>
          <span className="choice-card__desc">
            Reusable template for a season or tour.
          </span>
        </button>
      </div>
    </section>
  );
}

function EventDateInput({
  value,
  isoValue,
  minIso,
  maxIso,
  onInput,
  onIsoSelect,
  onBlur,
  inputId,
}: {
  value: string;
  isoValue: string;
  minIso: string;
  maxIso: string;
  onInput: (value: string) => void;
  onIsoSelect: (iso: string) => void;
  onBlur: () => void;
  inputId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const source = isoValue || minIso;
    const [y, m] = source.split("-").map(Number);
    return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const source = isoValue || minIso;
    const [y, m] = source.split("-").map(Number);
    setMonthCursor(new Date(y || new Date().getFullYear(), (m || 1) - 1, 1));
  }, [isoValue, minIso]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const days = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const monthStart = new Date(year, month, 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, idx) => {
      const day = new Date(monthStart);
      day.setDate(monthStart.getDate() + idx);
      const yyyy = day.getFullYear();
      const mm = String(day.getMonth() + 1).padStart(2, "0");
      const dd = String(day.getDate()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}`;
      return { iso, label: dd, inMonth: day.getMonth() === month };
    });
  }, [monthCursor]);

  return (
    <div className="date-input-wrap" ref={wrapperRef}>
      <div className="date-input-control">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          lang="en-GB"
          placeholder="DD/MM/YYYY"
          value={value}
          onChange={(e) => onInput(e.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          className="date-input-calendar-toggle"
          aria-label="Toggle calendar"
          onClick={() => setIsOpen((current) => !current)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
            <path d="M7 3.5v4M17 3.5v4M3.5 9.5h17" />
          </svg>
        </button>
      </div>
      {isOpen ? (
        <div className="calendar-popover" role="dialog" aria-label="Calendar">
          <div className="calendar-popover__header">
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setMonthCursor(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              ←
            </button>
            <strong>
              {new Intl.DateTimeFormat("en-GB", {
                month: "long",
                year: "numeric",
              }).format(monthCursor)}
            </strong>
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setMonthCursor(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              →
            </button>
          </div>
          <div className="calendar-grid">
            {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map(
              (label) => (
                <span key={label} className="calendar-grid__weekday">
                  {label}
                </span>
              ),
            )}
            {days.map((day) => {
              const isDisabled = day.iso < minIso || day.iso > maxIso;
              const isSelected = day.iso === isoValue;
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={
                    isSelected
                      ? "calendar-grid__day is-selected"
                      : day.inMonth
                        ? "calendar-grid__day"
                        : "calendar-grid__day is-outside"
                  }
                  disabled={isDisabled}
                  onClick={() => {
                    onIsoSelect(day.iso);
                    setIsOpen(false);
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type NewProjectPageProps = {
  navigate: (path: string) => void;
  onCreated: () => Promise<void>;
  bands: BandOption[];
  editingProjectId?: string;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
  origin?: string | null;
  fromPath?: string | null;
};
function NewEventProjectPage({
  navigate,
  onCreated,
  bands,
  editingProjectId,
  registerNavigationGuard,
  origin,
  fromPath,
}: NewProjectPageProps) {
  const [existingProject, setExistingProject] =
    useState<NewProjectPayload | null>(null);
  const [eventDateIso, setEventDateIso] = useState("");
  const [eventDateInput, setEventDateInput] = useState("");
  const [eventDateError, setEventDateError] = useState("");
  const [eventDateTouched, setEventDateTouched] = useState(false);
  const [eventVenue, setEventVenue] = useState("");
  const [bandRef, setBandRef] = useState("");
  const [status, setStatus] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const initialSnapshotRef = useRef({ date: "", venue: "", bandRef: "" });
  const todayIso = getTodayIsoLocal();
  const maxEventDateIso = useMemo(() => {
    const base = new Date(`${todayIso}T00:00:00`);
    base.setFullYear(base.getFullYear() + 10);
    return getTodayIsoLocal(base);
  }, [todayIso]);
  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(
    eventDateIso &&
    !isPastIsoDate(eventDateIso, todayIso) &&
    eventDateIso <= maxEventDateIso &&
    eventVenue.trim() &&
    selectedBand,
  );

  useEffect(() => {
    if (!editingProjectId) return;
    invoke<string>("read_project", { projectId: editingProjectId })
      .then((raw) => {
        const project = JSON.parse(raw) as NewProjectPayload;
        setExistingProject(project);
        setEventDateIso(project.eventDate ?? "");
        setEventDateInput(
          project.eventDate ? formatIsoDateToUs(project.eventDate) : "",
        );
        setEventVenue(project.eventVenue ?? "");
        setBandRef(project.bandRef);
        initialSnapshotRef.current = {
          date: project.eventDate ?? "",
          venue: (project.eventVenue ?? "").trim(),
          bandRef: project.bandRef ?? "",
        };
      })
      .catch(() => setStatus("Failed to load existing event setup."));
  }, [editingProjectId]);

  function getDateValidationMessage(value: string) {
    const parsed = parseDDMMYYYYToISO(value);
    if (!parsed) return "Invalid date. Use DD/MM/YYYY.";
    if (isPastIsoDate(parsed, todayIso)) return "Date cannot be in the past.";
    if (parsed > maxEventDateIso) {
      return `Date must be between today and ${formatIsoDateToUs(maxEventDateIso)}.`;
    }
    return "";
  }

  function updateDateInput(value: string) {
    const normalizedInput = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
      ? acceptISOToDDMMYYYY(value.trim())
      : formatDateDigitsToDDMMYYYY(value);
    setEventDateInput(normalizedInput);
    const parsed = parseDDMMYYYYToISO(normalizedInput);
    const message = getDateValidationMessage(normalizedInput);
    if (eventDateTouched) setEventDateError(message);
    setEventDateIso(!parsed || message ? "" : parsed);
  }

  const isDirty = isSetupInfoDirty(initialSnapshotRef.current, {
    date: eventDateIso,
    venue: eventVenue.trim(),
    bandRef,
  });

  const persist = useCallback(async (targetId?: string) => {
    if (!selectedBand || !eventDateIso || !eventVenue.trim()) return;
    const namingSource = { purpose: "event" as const, eventDate: eventDateIso, eventVenue, documentDate: todayIso };
    const slug = formatProjectSlug(namingSource, selectedBand);
    const displayName = formatProjectDisplayName(namingSource, selectedBand);
    const id = targetId ?? editingProjectId ?? generateUuidV7();
    const nowIso = new Date().toISOString();
    let defaultLineup = existingProject?.lineup;
    let defaultBandLeaderId = existingProject?.bandLeaderId;
    if (!editingProjectId) {
      try {
        const setupDefaults = await invoke<BandSetupData>("get_band_setup_data", {
          bandId: selectedBand.id,
        });
        defaultLineup = { ...(setupDefaults.defaultLineup ?? {}) };
        if (!Object.keys(defaultLineup).length) {
          console.error("Band default lineup is empty during event project creation", {
            bandRef: selectedBand.id,
          });
        }
        defaultBandLeaderId = setupDefaults.bandLeader ?? "";
      } catch (error) {
        console.error("Failed to load setup defaults for new event project", {
          bandRef: selectedBand.id,
          error,
        });
        defaultLineup = {};
        defaultBandLeaderId = "";
      }
    }
    const payload: NewProjectPayload = {
      id,
      slug,
      displayName,
      purpose: "event",
      templateType: "event",
      status: "active",
      eventDate: eventDateIso,
      eventVenue: eventVenue.trim(),
      bandRef: selectedBand.id,
      documentDate: todayIso,
      createdAt: existingProject?.createdAt ?? nowIso,
      updatedAt: nowIso,
      lineup: defaultLineup,
      bandLeaderId: defaultBandLeaderId || undefined,
      talkbackOwnerId: existingProject?.talkbackOwnerId,
      note: existingProject?.note,
    };
    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(toPersistableProject(payload), null, 2),
    });
    await onCreated();
    return id;
  }, [
    selectedBand,
    eventDateIso,
    eventVenue,
    editingProjectId,
    todayIso,
    existingProject,
    onCreated,
  ]);

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => !isCommitting && isDirty,
      save: () => persist().then(() => undefined),
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, persist, isCommitting]);

  async function createProject() {
    const message = getDateValidationMessage(eventDateInput);
    if (message) {
      setEventDateTouched(true);
      setEventDateError(message);
    }
    if (
      !selectedBand ||
      !eventDateIso ||
      !eventVenue.trim() ||
      Boolean(message)
    )
      return setStatus("Date, venue, and band are required.");
    const id = editingProjectId ?? generateUuidV7();
    setIsCommitting(true);
    if (editingProjectId && !isDirty) {
      navigate(`/projects/${encodeURIComponent(id)}/setup`);
      return;
    }
    await persist(id);
    navigate(`/projects/${encodeURIComponent(id)}/setup`);
  }

  const backTarget =
    editingProjectId && fromPath
      ? fromPath
      : editingProjectId && origin === "setup"
        ? `/projects/${encodeURIComponent(editingProjectId)}/setup`
        : editingProjectId
          ? "/"
          : "/projects/new";
  const exitTarget = editingProjectId ? "/" : "/";
  const navigationContext = getNavigationContextLabel(origin);

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{editingProjectId ? "Edit Event Setup" : "New Event Project"}</h2>
      </div>
      {navigationContext ? (
        <p className="subtle page-context">Opened from: {navigationContext}</p>
      ) : null}
      <div className="form-grid">
        <label htmlFor="event-date-input">
          Date *
          <EventDateInput
            value={eventDateInput}
            isoValue={eventDateIso}
            minIso={todayIso}
            maxIso={maxEventDateIso}
            onInput={updateDateInput}
            inputId="event-date-input"
            onBlur={() => {
              setEventDateTouched(true);
              const message = getDateValidationMessage(eventDateInput);
              if (message) {
                setEventDateError(message);
                setEventDateIso("");
                return;
              }
              const parsed = parseUsDateInput(eventDateInput);
              if (!parsed) return;
              setEventDateError("");
              setEventDateIso(parsed);
              setEventDateInput(formatIsoDateToUs(parsed));
            }}
            onIsoSelect={(iso) => {
              setEventDateTouched(true);
              setEventDateError("");
              setEventDateIso(iso);
              setEventDateInput(formatIsoDateToUs(iso));
            }}
          />
          {eventDateTouched && eventDateError ? (
            <p className="field-error">{eventDateError}</p>
          ) : null}
        </label>
        <label>
          Venue *
          <input
            type="text"
            value={eventVenue}
            onChange={(e) => setEventVenue(e.target.value)}
            placeholder="City"
          />
        </label>
        <label>
          Band *
          <select value={bandRef} onChange={(e) => setBandRef(e.target.value)}>
            <option value="">Select band</option>
            {bands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {status ? <p className="status status--error">{status}</p> : null}
      <div className="setup-action-bar setup-action-bar--equal">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate(backTarget)}
        >
          Back
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate(exitTarget)}
        >
          Back to Hub
        </button>
        <button type="button" onClick={createProject} disabled={!canSubmit}>
          {editingProjectId
            ? isDirty
              ? "Save & Continue"
              : "Continue"
            : "Save & Create"}
        </button>
      </div>
    </section>
  );
}

function NewGenericProjectPage({
  navigate,
  onCreated,
  bands,
  editingProjectId,
  registerNavigationGuard,
  origin,
  fromPath,
}: NewProjectPageProps) {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 10;
  const [validityYear, setValidityYear] = useState<string>(String(currentYear));
  const [validityYearTouched, setValidityYearTouched] = useState(false);
  const [note, setNote] = useState("");
  const [bandRef, setBandRef] = useState("");
  const [status, setStatus] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const initialSnapshotRef = useRef({ date: "", venue: "", bandRef: "" });
  function validateValidityYear(raw: string): string | null {
    const value = raw.trim();

    if (!value) return "Year is required.";

    if (!/^\d{4}$/.test(value)) {
      return "Enter a valid year (YYYY).";
    }

    const year = Number(value);

    if (Number.isNaN(year)) return "Enter a valid year (YYYY).";

    if (year < currentYear) return "Year cannot be in the past.";
    if (year > maxYear) return `Year must be between ${currentYear} and ${maxYear}.`;

    return null;
  }

  const validityYearError = validityYearTouched
    ? validateValidityYear(validityYear)
    : null;
  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(selectedBand && !validateValidityYear(validityYear));

  useEffect(() => {
    if (!editingProjectId) return;
    invoke<string>("read_project", { projectId: editingProjectId })
      .then((raw) => {
        const project = JSON.parse(raw) as NewProjectPayload;
        setBandRef(project.bandRef);
        setNote(project.note ?? "");
        setValidityYear(project.documentDate.slice(0, 4));
        initialSnapshotRef.current = {
          date: project.eventDate ?? "",
          venue: (project.eventVenue ?? "").trim(),
          bandRef: project.bandRef ?? "",
        };
      })
      .catch(() => setStatus("Failed to load existing generic setup."));
  }, [editingProjectId]);

  const isDirty = isSetupInfoDirty(initialSnapshotRef.current, {
    date: "",
    venue: "",
    bandRef,
  });

  const persist = useCallback(async (targetId?: string) => {
    if (!selectedBand) return;
    const id = targetId ?? editingProjectId ?? generateUuidV7();
    const nowIso = new Date().toISOString();
    let defaultLineup: LineupMap | undefined;
    let defaultBandLeaderId = "";
    if (!editingProjectId) {
      try {
        const setupDefaults = await invoke<BandSetupData>("get_band_setup_data", {
          bandId: selectedBand.id,
        });
        defaultLineup = { ...(setupDefaults.defaultLineup ?? {}) };
        if (!Object.keys(defaultLineup).length) {
          console.error("Band default lineup is empty during generic project creation", {
            bandRef: selectedBand.id,
          });
        }
        defaultBandLeaderId = setupDefaults.bandLeader ?? "";
      } catch (error) {
        console.error("Failed to load setup defaults for new generic project", {
          bandRef: selectedBand.id,
          error,
        });
        defaultLineup = {};
      }
    }
    const payload: NewProjectPayload = {
      id,
      slug: formatProjectSlug({ purpose: "generic", documentDate: `${validityYear}-01-01`, note }, selectedBand),
      displayName: formatProjectDisplayName({ purpose: "generic", documentDate: `${validityYear}-01-01`, note }, selectedBand),
      purpose: "generic",
      templateType: "generic",
      status: "active",
      bandRef: selectedBand.id,
      documentDate: `${validityYear}-01-01`,
      ...(note.trim() ? { note: note.trim() } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
      lineup: defaultLineup,
      bandLeaderId: defaultBandLeaderId || undefined,
    };
    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(toPersistableProject(payload), null, 2),
    });
    await onCreated();
    return id;
  }, [editingProjectId, note, onCreated, selectedBand, validityYear]);

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => !isCommitting && isDirty,
      save: () => persist().then(() => undefined),
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, persist, isCommitting]);

  async function createProject() {
    if (!selectedBand) return;
    const id = editingProjectId ?? generateUuidV7();
    setIsCommitting(true);
    await persist(id);
    navigate(`/projects/${encodeURIComponent(id)}/setup`);
  }

  const backTarget =
    editingProjectId && fromPath
      ? fromPath
      : editingProjectId && origin === "setup"
        ? `/projects/${encodeURIComponent(editingProjectId)}/setup`
        : editingProjectId
          ? "/"
          : "/projects/new";
  const navigationContext = getNavigationContextLabel(origin);

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>
          {editingProjectId ? "Edit Generic Setup" : "New Generic Project"}
        </h2>
      </div>
      {navigationContext ? (
        <p className="subtle page-context">Opened from: {navigationContext}</p>
      ) : null}
      <div className="form-grid">
        <label>
          Band *
          <select value={bandRef} onChange={(e) => setBandRef(e.target.value)}>
            <option value="">Select band</option>
            {bands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note
          <input
            type="text"
            value={note}
            placeholder="e.g. tour name or version"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label>
          Validity year *
          <input
            type="number"
            inputMode="numeric"
            min={currentYear}
            max={maxYear}
            step={1}
            value={validityYear}
            placeholder={String(currentYear)}
            onChange={(e) => {
              setValidityYear(e.target.value);
              setStatus("");
            }}
            onBlur={() => setValidityYearTouched(true)}
            aria-invalid={Boolean(validityYearError)}
          />
          {validityYearError ? (
            <p className="field-error">{validityYearError}</p>
          ) : null}
        </label>
      </div>
      {status ? <p className="status status--error">{status}</p> : null}
      <div className="setup-action-bar setup-action-bar--equal">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate(backTarget)}
        >
          Back
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
        >
          Back to Hub
        </button>
        <button type="button" onClick={createProject} disabled={!canSubmit}>
          {editingProjectId ? "Save & Continue" : "Save & Create"}
        </button>
      </div>
    </section>
  );
}

type ProjectRouteProps = {
  id: string;
  navigate: (path: string) => void;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
  search?: string;
};
function ProjectSetupPage({
  id,
  navigate,
  registerNavigationGuard,
  search = "",
}: ProjectRouteProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const [lineup, setLineup] = useState<LineupMap>({});
  const [editing, setEditing] = useState<{
    role: string;
    slotIndex: number;
    currentSelectedId?: string;
  } | null>(null);
  const [editingSetup, setEditingSetup] = useState<{
    role: string;
    slotIndex: number;
    musicianId: string;
  } | null>(null);
  const [setupDraftBySlot, setSetupDraftBySlot] = useState<Record<string, PresetOverridePatch | undefined>>({});
  const [selectedSetupSlotKey, setSelectedSetupSlotKey] = useState("");
  const [bandLeaderId, setBandLeaderId] = useState("");
  const [talkbackOwnerId, setTalkbackOwnerId] = useState("");
  const [status, setStatus] = useState("");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const initialSnapshotRef = useRef("");

  const buildSetupSnapshot = useCallback(
    (
      nextLineup: LineupMap,
      data: BandSetupData,
      storedLeader?: string,
      storedTalkback?: string,
    ) => {
      const selected = getUniqueSelectedMusicians(
        nextLineup,
        data.constraints,
        ROLE_ORDER,
      );
      const resolvedLeader = resolveBandLeaderId({
        selectedMusicianIds: selected,
        storedBandLeaderId: storedLeader,
        bandLeaderId: data.bandLeader,
        defaultContactId: data.defaultContactId,
      });
      const resolvedTalkback = resolveTalkbackOwnerId({
        selectedMusicianIds: selected,
        bandLeaderId: resolvedLeader,
        storedTalkbackOwnerId: storedTalkback,
      });
      return {
        lineup: nextLineup,
        bandLeaderId: resolvedLeader,
        talkbackOwnerId: resolvedTalkback,
      };
    },
    [],
  );

  const applyState = useCallback(
    (
      nextLineup: LineupMap,
      data: BandSetupData,
      storedLeader?: string,
      storedTalkback?: string,
    ) => {
      const snapshot = buildSetupSnapshot(
        nextLineup,
        data,
        storedLeader,
        storedTalkback,
      );
      setLineup(nextLineup);
      setBandLeaderId(snapshot.bandLeaderId);
      setTalkbackOwnerId(snapshot.talkbackOwnerId);
    },
    [buildSetupSnapshot],
  );

  useEffect(() => {
    (async () => {
      const parsed = JSON.parse(
        await invoke<string>("read_project", { projectId: id }),
      ) as NewProjectPayload;
      setProject(parsed);
      let data: BandSetupData;
      try {
        data = await invoke<BandSetupData>("get_band_setup_data", {
          bandId: parsed.bandRef,
        });
      } catch (error) {
        console.error("Failed to load band setup data", {
          projectId: id,
          bandRef: parsed.bandRef,
          error,
        });
        data = createFallbackSetupData(parsed);
        setStatus(
          "Band defaults could not be loaded. You can still configure lineup manually.",
        );
      }
      if (data.loadWarnings?.length) {
        console.warn("Band setup loaded with warnings", {
          projectId: id,
          bandRef: parsed.bandRef,
          warnings: data.loadWarnings,
        });
        setStatus(data.loadWarnings.join("\n"));
      }
      setSetupData(data);
      const hasStoredLineup = Boolean(parsed.lineup && Object.keys(parsed.lineup).length > 0);
      const fallbackLineup = { ...(data.defaultLineup ?? {}) };
      if (!hasStoredLineup && !Object.keys(fallbackLineup).length) {
        console.error("Band default lineup is empty during setup initialization", {
          projectId: id,
          bandRef: parsed.bandRef,
        });
      }
      const initialLineup = { ...(hasStoredLineup ? parsed.lineup : fallbackLineup) };
      const initialState = buildSetupSnapshot(
        initialLineup,
        data,
        parsed.bandLeaderId,
        parsed.talkbackOwnerId,
      );
      applyState(
        initialLineup,
        data,
        parsed.bandLeaderId,
        parsed.talkbackOwnerId,
      );
      if (!hasStoredLineup) {
        const updatedProject: NewProjectPayload = {
          ...parsed,
          lineup: initialState.lineup,
          bandLeaderId: initialState.bandLeaderId || undefined,
          ...(initialState.talkbackOwnerId && initialState.talkbackOwnerId !== initialState.bandLeaderId
            ? { talkbackOwnerId: initialState.talkbackOwnerId }
            : {}),
          updatedAt: new Date().toISOString(),
        };
        await invoke("save_project", {
          projectId: id,
          json: JSON.stringify(toPersistableProject(updatedProject), null, 2),
        });
        setProject(updatedProject);
      }
      initialSnapshotRef.current = JSON.stringify(initialState);
    })().catch((error) => {
      console.error("Failed to initialize setup page", { projectId: id, error });
      setStatus("Failed to load setup.");
    });
  }, [id, applyState, buildSetupSnapshot]);

  const errors = useMemo(
    () =>
      !setupData
        ? []
        : validateLineup(
          lineup,
          setupData.constraints,
          ROLE_ORDER,
          setupData.roleConstraints,
        ),
    [lineup, setupData],
  );
  const selectedMusicianIds = useMemo(
    () =>
      !setupData
        ? []
        : getUniqueSelectedMusicians(lineup, setupData.constraints, ROLE_ORDER),
    [lineup, setupData],
  );
  const selectedOptions = useMemo(() => {
    if (!setupData) return [] as MemberOption[];
    const byId = new Map<string, MemberOption>();
    Object.values(setupData.members)
      .flat()
      .forEach((m) => byId.set(m.id, m));
    return selectedMusicianIds
      .map((idValue) => byId.get(idValue))
      .filter(Boolean) as MemberOption[];
  }, [selectedMusicianIds, setupData]);
  const talkbackCurrentOwnerId = talkbackOwnerId || bandLeaderId;

  const currentSnapshot = JSON.stringify({
    lineup,
    bandLeaderId,
    talkbackOwnerId: talkbackCurrentOwnerId,
  });
  const defaultSnapshot = useMemo(() => {
    if (!setupData) return "";
    const defaults = buildSetupSnapshot(
      { ...(setupData.defaultLineup ?? {}) },
      setupData,
    );
    return JSON.stringify(defaults);
  }, [setupData, buildSetupSnapshot]);
  const isDirty = Boolean(
    project && currentSnapshot !== initialSnapshotRef.current,
  );

  async function persistProject(next?: Partial<NewProjectPayload>) {
    if (!project) return;
    const payload: NewProjectPayload = {
      ...project,
      lineup: { ...lineup },
      bandLeaderId,
      ...(talkbackCurrentOwnerId && talkbackCurrentOwnerId !== bandLeaderId
        ? { talkbackOwnerId: talkbackCurrentOwnerId }
        : {}),
      ...next,
    };
    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(toPersistableProject(payload), null, 2),
    });
    setProject(payload);
    initialSnapshotRef.current = JSON.stringify({
      lineup: payload.lineup ?? {},
      bandLeaderId: payload.bandLeaderId ?? "",
      talkbackOwnerId: payload.talkbackOwnerId ?? payload.bandLeaderId ?? "",
    });
  }

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => !isCommitting && isDirty,
      save: persistProject,
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, isCommitting]);

  function setRoleSlots(role: string, slots: LineupSlotValue[]) {
    if (!setupData) return;
    const constraint = normalizeRoleConstraint(role, setupData.constraints[role]);
    const compact = slots.filter((slot) => Boolean(slot.musicianId));
    const value = constraint.max <= 1 ? compact[0] : compact;
    const nextLineup = { ...lineup, [role]: value as LineupMap[string] };
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  function updateSlot(role: string, slotIndex: number, musicianId: string) {
    if (!setupData) return;
    const constraint = normalizeRoleConstraint(role, setupData.constraints[role]);
    const current = normalizeLineupSlots(lineup[role], constraint.max);
    while (current.length < Math.max(constraint.max, slotIndex + 1)) current.push({ musicianId: "" });
    const previous = current[slotIndex];
    current[slotIndex] = musicianId
      ? { musicianId, ...(previous?.musicianId === musicianId && previous?.presetOverride ? { presetOverride: previous.presetOverride } : {}) }
      : { musicianId: "" };
    setRoleSlots(role, current);
  }

  function applySetupDraftOverrides(draftOverrides: Record<string, PresetOverridePatch | undefined>) {
    if (!setupData) return;
    const nextLineup: LineupMap = { ...lineup };
    ROLE_ORDER.forEach((role) => {
      const constraint = normalizeRoleConstraint(role, setupData.constraints[role]);
      const slots = normalizeLineupSlots(lineup[role], constraint.max).map((slot, slotIndex) => {
        if (!slot.musicianId) return slot;
        const override = draftOverrides[`${role}:${slotIndex}`];
        return { musicianId: slot.musicianId, ...(override ? { presetOverride: override } : {}) };
      });
      nextLineup[role] = (constraint.max <= 1 ? slots[0] : slots) as LineupMap[string];
    });
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  const effectiveSlotPresets = useMemo(() => {
    if (!setupData) return [] as Array<{ role: string; slotIndex: number; musicianId: string; patch?: PresetOverridePatch; effective: MusicianSetupPreset }>;
    return ROLE_ORDER.flatMap((role) => {
      const constraint = normalizeRoleConstraint(role, setupData.constraints[role]);
      return normalizeLineupSlots(lineup[role], constraint.max).map((slot, slotIndex) => ({
        role,
        slotIndex,
        musicianId: slot.musicianId,
        patch: slot.presetOverride,
        effective: (() => {
          const resolved = resolveEffectiveMusicianSetup({ musicianDefaults: getGroupDefaultPreset(role as Group), eventOverride: slot.presetOverride, group: role as Group });
          return { inputs: resolved.effectiveInputs, monitoring: resolved.effectiveMonitoring };
        })(),
      }));
    });
  }, [lineup, setupData]);

  const overrideValidationErrors = useMemo(
    () => validateEffectivePresets(effectiveSlotPresets.map((slot) => ({ group: slot.role, preset: slot.effective }))),
    [effectiveSlotPresets],
  );

  const backSetupPath =
    project?.purpose === "generic"
      ? `/projects/${encodeURIComponent(id)}/generic`
      : `/projects/${encodeURIComponent(id)}/event`;
  const fromPath = useMemo(
    () => new URLSearchParams(search).get("fromPath"),
    [search],
  );
  const bandName = project?.displayName ?? setupData?.name ?? project?.bandRef ?? "—";
  const selectedMusicianMap = useMemo(() => new Map(selectedOptions.map((item) => [item.id, item.name])), [selectedOptions]);
  const setupMusicians = useMemo(() => {
    if (!setupData || !editingSetup) return [] as SetupMusicianItem[];
    const role = editingSetup.role;
    const constraint = normalizeRoleConstraint(role, setupData.constraints[role]);
    return normalizeLineupSlots(lineup[role], constraint.max)
      .map((slot, slotIndex) => ({ role, slotIndex, slot }))
      .filter(({ slot }) => Boolean(slot.musicianId))
      .map(({ role, slotIndex, slot }) => ({
        slotKey: `${role}:${slotIndex}`,
        musicianId: slot.musicianId,
        musicianName: selectedMusicianMap.get(slot.musicianId) ?? slot.musicianId,
        role: role as Group,
        hasOverride: Boolean(slot.presetOverride),
      }));
  }, [editingSetup, lineup, selectedMusicianMap, setupData]);

  const selectedSetupMusician = setupMusicians.find((item) => item.slotKey === selectedSetupSlotKey) ?? setupMusicians[0];

  const resetModalRef = useModalBehavior(showResetConfirmation, () =>
    setShowResetConfirmation(false),
  );
  const musicianSelectorRef = useModalBehavior(
    Boolean(editing && setupData),
    () => setEditing(null),
  );
  const setupEditorRef = useModalBehavior(Boolean(editingSetup), () => {
    setEditingSetup(null);
    setSetupDraftBySlot({});
    setSelectedSetupSlotKey("");
  });

  return (
    <section className="panel panel--setup">
      <div className="panel__header">
        <h2>Lineup Setup</h2>
      </div>
      <div className="lineup-meta">
        <div className="band-name">{bandName}</div>
      </div>
      <div className="lineup-helper">
        <p className="subtle">
          Configure lineup for Input List and Stage Plan.
          <br />
          Defaults are prefilled from the band’s saved lineup settings.
        </p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => setShowResetConfirmation(true)}
          disabled={
            !setupData || !project || currentSnapshot === defaultSnapshot
          }
        >
          Reset to defaults
        </button>
      </div>
      <div className="lineup-grid">
        {setupData
          ? ROLE_ORDER.map((role) => {
            const constraint = normalizeRoleConstraint(
              role,
              setupData.constraints[role],
            );
            const selected = normalizeLineupValue(
              lineup[role],
              constraint.max,
            );
            const members = setupData.members[role] || [];
            return (
              <article key={role} className="lineup-card">
                <h3>
                  {getRoleDisplayName(
                    role,
                    setupData.constraints,
                    setupData.roleConstraints,
                  )}
                </h3>
                <div className="lineup-card__body section-divider">
                  <div className="lineup-list lineup-list--single">
                    {(selected.length ? selected : [""]).map(
                      (musicianId, index) => {
                        const alternatives = members.filter(
                          (m) => m.id !== musicianId,
                        );
                        return (
                          <div
                            key={`${role}-${index}`}
                            className="lineup-list__row"
                          >
                            <span className="lineup-list__name">
                              {musicianId
                                ? (members.find((m) => m.id === musicianId)
                                  ?.name ?? musicianId)
                                : "Not selected"}
                            </span>
                            <div className="lineup-list__actions">
                              <button
                                type="button"
                                className="button-secondary"
                                disabled={alternatives.length === 0}
                                onClick={() =>
                                  setEditing({
                                    role,
                                    slotIndex: index,
                                    currentSelectedId: musicianId || undefined,
                                  })
                                }
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                className="button-secondary"
                                disabled={!musicianId}
                                onClick={() => {
                                  if (!setupData) return;
                                  const draftEntries: Record<string, PresetOverridePatch | undefined> = {};
                                  ROLE_ORDER.forEach((setupRole) => {
                                    const setupConstraint = normalizeRoleConstraint(setupRole, setupData.constraints[setupRole]);
                                    normalizeLineupSlots(lineup[setupRole], setupConstraint.max).forEach((setupSlot, setupIndex) => {
                                      if (!setupSlot.musicianId) return;
                                      draftEntries[`${setupRole}:${setupIndex}`] = setupSlot.presetOverride;
                                    });
                                  });
                                  setSetupDraftBySlot(draftEntries);
                                  const slotKey = `${role}:${index}`;
                                  setSelectedSetupSlotKey(slotKey);
                                  setEditingSetup({ role, slotIndex: index, musicianId });
                                }}
                              >
                                Setup{normalizeLineupSlots(lineup[role], constraint.max)[index]?.presetOverride ? " •" : ""}
                              </button>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </article>
            );
          })
          : ROLE_ORDER.map((role) => {
            const constraint = normalizeRoleConstraint(role);
            return (
              <article key={role} className="lineup-card">
                <h3>{getRoleDisplayName(role)}</h3>
                <div className="lineup-card__body section-divider">
                  <div className="lineup-list lineup-list--single">
                    {Array.from({ length: Math.max(1, constraint.max) }).map(
                      (_, index) => (
                        <div key={`${role}-${index}`} className="lineup-list__row">
                          <span className="lineup-list__name">Not selected</span>
                          <div className="lineup-list__actions">
                            <button type="button" className="button-secondary" disabled>
                              Change
                            </button>
                            <button type="button" className="button-secondary" disabled>
                              Setup
                            </button>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        <p className="subtle">
          Select the on-site band lead for coordination and decisions.
        </p>
        <article className="lineup-card">
          <h3>BAND LEADER</h3>
          <div className="lineup-card__body section-divider">
            <div className="lineup-list__row">
              <span className="lineup-list__name">
                {selectedOptions.find((m) => m.id === bandLeaderId)?.name ||
                  "Not selected"}
              </span>
              <button
                type="button"
                className="button-secondary"
                disabled={
                  selectedOptions.filter((m) => m.id !== bandLeaderId)
                    .length === 0
                }
                onClick={() =>
                  setEditing({
                    role: "leader",
                    slotIndex: 0,
                    currentSelectedId: bandLeaderId,
                  })
                }
              >
                Change
              </button>
            </div>
          </div>
        </article>
        <p className="subtle">Assign talkback microphone owner.</p>
        <article className="lineup-card">
          <h3>TALKBACK</h3>
          <div className="lineup-card__body section-divider">
            <div className="lineup-list__row">
              <span className="lineup-list__name">
                {selectedOptions.find((m) => m.id === talkbackCurrentOwnerId)
                  ?.name || "Use band leader default"}
              </span>
              <button
                type="button"
                className="button-secondary"
                disabled={
                  selectedOptions.filter((m) => m.id !== talkbackCurrentOwnerId)
                    .length === 0
                }
                onClick={() =>
                  setEditing({
                    role: "talkback",
                    slotIndex: 0,
                    currentSelectedId: talkbackCurrentOwnerId,
                  })
                }
              >
                Change
              </button>
            </div>
          </div>
        </article>
      </div>
      {errors.length + overrideValidationErrors.length > 0 ? (
        <div className="status status--error">
          {[...errors, ...overrideValidationErrors].map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      {status ? <p className="status status--error">{status}</p> : null}

      <div className="setup-action-bar">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate(fromPath || withFrom(backSetupPath, "setup"))}
        >
          Back
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
        >
          Back to Hub
        </button>
        <button
          type="button"
          onClick={async () => {
            if (errors.length > 0 || overrideValidationErrors.length > 0) return;
            if (isDirty) {
              setIsCommitting(true);
              await persistProject();
            }
            navigate(withFrom(`/projects/${id}/preview`, "setup"));
          }}
          disabled={errors.length > 0 || overrideValidationErrors.length > 0}
        >
          {isDirty ? "Save & Continue" : "Continue"}
        </button>
      </div>

      <ModalOverlay
        open={showResetConfirmation}
        onClose={() => setShowResetConfirmation(false)}
      >
        <div
          className="selector-dialog"
          role="alertdialog"
          aria-modal="true"
          ref={resetModalRef}
        >
          <button
            type="button"
            className="modal-close"
            onClick={() => setShowResetConfirmation(false)}
            aria-label="Close"
          >
            ×
          </button>
          <div className="panel__header panel__header--stack">
            <h3>Reset to defaults?</h3>
            <p className="subtle">
              This will reset lineup, band leader, and talkback to the band
              defaults.
            </p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowResetConfirmation(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!setupData) return;
                applyState({ ...(setupData.defaultLineup ?? {}) }, setupData);
                setShowResetConfirmation(false);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </ModalOverlay>

      <ModalOverlay open={Boolean(editingSetup)} onClose={() => { setEditingSetup(null); setSetupDraftBySlot({}); setSelectedSetupSlotKey(""); }}>
        {editingSetup && selectedSetupMusician ? (() => {
          const currentPatch = setupDraftBySlot[selectedSetupMusician.slotKey];
          const defaults = getGroupDefaultPreset(selectedSetupMusician.role);
          const resolved = resolveEffectiveMusicianSetup({
            musicianDefaults: defaults,
            eventOverride: currentPatch,
            group: selectedSetupMusician.role,
          });
          const effective = { inputs: resolved.effectiveInputs, monitoring: resolved.effectiveMonitoring };
          const availableInputs = (GROUP_INPUT_LIBRARY[selectedSetupMusician.role as keyof typeof GROUP_INPUT_LIBRARY] ?? []).filter(
            (item: InputChannel) => !effective.inputs.some((effectiveItem) => effectiveItem.key === item.key),
          );
          const drumSetup = selectedSetupMusician.role === "drums" ? inferDrumSetupFromLegacyInputs(effective.inputs) : null;
          const modalErrors = validateEffectivePresets(
            setupMusicians.map((slot) => {
              const slotPatch = setupDraftBySlot[slot.slotKey];
              const slotDefaults = getGroupDefaultPreset(slot.role);
              const slotResolved = resolveEffectiveMusicianSetup({ musicianDefaults: slotDefaults, eventOverride: slotPatch, group: slot.role });
              return { group: slot.role, preset: { inputs: slotResolved.effectiveInputs, monitoring: slotResolved.effectiveMonitoring } };
            }),
          );
          return (
            <div
              className="selector-dialog selector-dialog--setup-editor"
              role="dialog"
              aria-modal="true"
              ref={setupEditorRef}
            >
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setEditingSetup(null);
                  setSetupDraftBySlot({});
                  setSelectedSetupSlotKey("");
                }}
                aria-label="Close"
              >
                ×
              </button>
              <div className="panel__header panel__header--stack selector-dialog__title">
                <h3>Setup for this event — {selectedSetupMusician.musicianName}</h3>
                <p className="subtle"><span className="setup-badge">{selectedSetupMusician.role}</span> Changes here apply only to this event. Band defaults are not modified.</p>
              </div>
              <div className="setup-musician-layout">
                <MusicianSelector
                  items={setupMusicians.map((item) => ({
                    ...item,
                    hasOverride: Boolean(setupDraftBySlot[item.slotKey]),
                  }))}
                  selectedSlotKey={selectedSetupMusician.slotKey}
                  onSelect={setSelectedSetupSlotKey}
                />
                <div className="setup-editor-grid">
                  {selectedSetupMusician.role === "drums" && drumSetup ? (
                    <DrumsPartsEditor
                      setup={drumSetup}
                      onChange={(nextSetup) => {
                        const targetInputs = resolveDrumInputs(nextSetup);
                        setSetupDraftBySlot((prev) => {
                          const prior = prev[selectedSetupMusician.slotKey];
                          const nextInputsPatch = buildInputsPatchFromTarget(resolved.defaultPreset.inputs, targetInputs);
                          return {
                            ...prev,
                            [selectedSetupMusician.slotKey]: {
                              ...prior,
                              ...(Object.keys(nextInputsPatch).length > 0 ? { inputs: nextInputsPatch } : {}),
                            },
                          };
                        });
                      }}
                    />
                  ) : null}
                  <SelectedInputsList
                    effectiveInputs={effective.inputs}
                    inputDiffMeta={resolved.diffMeta.inputs}
                    availableInputs={selectedSetupMusician.role === "drums" ? [] : availableInputs}
                    nonRemovableKeys={selectedSetupMusician.role === "drums" ? ["dr_kick_out", "dr_kick_in", "dr_snare1_top", "dr_snare1_bottom"] : []}
                    onRemoveInput={(key) => {
                      setSetupDraftBySlot((prev) => {
                        const prior = prev[selectedSetupMusician.slotKey];
                        const nextRemove = Array.from(new Set([...(prior?.inputs?.removeKeys ?? []), key]));
                        const nextAdd = (prior?.inputs?.add ?? []).filter((item) => item.key !== key);
                        return {
                          ...prev,
                          [selectedSetupMusician.slotKey]: {
                            ...prior,
                            inputs: { ...prior?.inputs, removeKeys: nextRemove, add: nextAdd },
                          },
                        };
                      });
                    }}
                    onAddInput={(input) => {
                      setSetupDraftBySlot((prev) => {
                        const prior = prev[selectedSetupMusician.slotKey];
                        const hasInput = (prior?.inputs?.add ?? []).some((item) => item.key === input.key);
                        if (hasInput) return prev;
                        return {
                          ...prev,
                          [selectedSetupMusician.slotKey]: {
                            ...prior,
                            inputs: {
                              ...prior?.inputs,
                              add: [...(prior?.inputs?.add ?? []), input],
                              removeKeys: (prior?.inputs?.removeKeys ?? []).filter((item) => item !== input.key),
                            },
                          },
                        };
                      });
                    }}
                  />
                  <MonitoringEditor
                    effectiveMonitoring={effective.monitoring}
                    patch={currentPatch}
                    diffMeta={resolved.diffMeta}
                    onChangePatch={(nextPatch) =>
                      setSetupDraftBySlot((prev) => ({
                        ...prev,
                        [selectedSetupMusician.slotKey]: nextPatch,
                      }))
                    }
                  />
                </div>
              </div>
              {modalErrors.length > 0 ? (
                <div className="status status--error">
                  {modalErrors.map((error) => <p key={error}>{error}</p>)}
                </div>
              ) : null}
              <div className="modal-actions modal-actions--setup">
                <button type="button" className="button-secondary" onClick={() => { setEditingSetup(null); setSetupDraftBySlot({}); setSelectedSetupSlotKey(""); }}>Back</button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() =>
                    setSetupDraftBySlot((prev) => ({
                      ...prev,
                      [selectedSetupMusician.slotKey]: undefined,
                    }))
                  }
                >
                  Reset overrides
                </button>
                <button
                  type="button"
                  disabled={modalErrors.length > 0}
                  onClick={() => {
                    applySetupDraftOverrides(setupDraftBySlot);
                    setEditingSetup(null);
                    setSetupDraftBySlot({});
                    setSelectedSetupSlotKey("");
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          );
        })() : null}
      </ModalOverlay>

      <ModalOverlay open={Boolean(editing && setupData)} onClose={() => setEditing(null)}>
        {editing && setupData ? (
          <div
            className="selector-dialog selector-dialog--musician-select"
            role="dialog"
            aria-modal="true"
            ref={musicianSelectorRef}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setEditing(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="panel__header panel__header--stack selector-dialog__title">
              <h3>
                Select{" "}
                {getRoleDisplayName(
                  editing.role,
                  setupData.constraints,
                  setupData.roleConstraints,
                )}
              </h3>
            </div>
            <div className="selector-dialog__divider section-divider" />
            <div className="selector-list">
              {(editing.role === "leader"
                ? selectedOptions
                : editing.role === "talkback"
                  ? selectedOptions
                  : setupData.members[editing.role] || []
              ).map((member) => (
                <button
                  type="button"
                  key={member.id}
                  className={
                    member.id === editing.currentSelectedId
                      ? "selector-option selector-option--selected"
                      : "selector-option"
                  }
                  onClick={() => {
                    if (editing.role === "leader") setBandLeaderId(member.id);
                    else if (editing.role === "talkback")
                      setTalkbackOwnerId(member.id);
                    else updateSlot(editing.role, editing.slotIndex, member.id);
                    setEditing(null);
                  }}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </ModalOverlay>
    </section>
  );
}


type LibraryPageProps = {
  navigate: (path: string) => void;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
};

function LibraryBandsPage({ navigate, registerNavigationGuard }: LibraryPageProps) {
  const [bands, setBands] = useState<LibraryBand[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    invoke<LibraryBand[]>("list_library_bands").then(setBands).catch(() => undefined);
    registerNavigationGuard(null);
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard]);
  const filtered = bands.filter((band) => {
    const q = query.trim().toLowerCase();
    return !q || band.name.toLowerCase().includes(q) || band.code.toLowerCase().includes(q);
  });
  return (
    <section className="panel">
      <div className="panel__header"><h2>Bands</h2><button type="button" onClick={() => navigate('/library/bands/new')}>+ New Band</button></div>
      <input placeholder="Search by name/code" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="library-table">
        {filtered.map((band) => (
          <div key={band.id} className="library-row">
            <span>{band.name}</span><span>{band.code}</span><span>{band.members.length}</span><span>{Object.keys(band.defaultLineup ?? {}).join(', ') || '—'}</span>
            <div className="project-actions">
              <button type="button" className="button-secondary" onClick={() => navigate(`/library/bands/${encodeURIComponent(band.id)}`)}>Edit</button>
              <button type="button" className="button-secondary" onClick={async () => { const copy = await invoke<LibraryBand>('duplicate_library_band', { bandId: band.id }); navigate(`/library/bands/${encodeURIComponent(copy.id)}`); }}>Duplicate</button>
              <button type="button" className="button-secondary" onClick={async () => { if (!window.confirm(`Delete ${band.name}?`)) return; await invoke('delete_library_band', { bandId: band.id }); setBands(await invoke<LibraryBand[]>('list_library_bands')); }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LibraryBandDetailPage({ bandId, navigate, registerNavigationGuard }: LibraryPageProps & { bandId: string }) {
  const isNew = bandId === 'new';
  const [musicians, setMusicians] = useState<LibraryMusician[]>([]);
  const [band, setBand] = useState<LibraryBand>({ id: '', name: '', code: '', description: '', constraints: { drums: { min: 0, max: 1 }, bass: { min: 0, max: 1 }, guitar: { min: 0, max: 1 }, keys: { min: 0, max: 1 }, vocs: { min: 0, max: 4 } }, roleConstraints: undefined, defaultLineup: {}, members: [], contacts: [], messages: [] });
  const initialRef = useRef('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    (async () => {
      setMusicians(await invoke<LibraryMusician[]>('list_library_musicians'));
      if (!isNew) {
        const loaded = await invoke<LibraryBand>('read_library_band', { bandId });
        setBand(loaded);
        initialRef.current = JSON.stringify(loaded);
      } else {
        initialRef.current = JSON.stringify(band);
      }
    })().catch(() => setStatus('Failed to load band'));
  }, [bandId, isNew]);
  const isDirty = JSON.stringify(band) !== initialRef.current;
  useEffect(() => {
    registerNavigationGuard({ isDirty: () => isDirty, save: async () => { await saveBand(); } });
    return () => registerNavigationGuard(null);
  });
  const saveBand = useCallback(async () => {
    const id = band.id || toIdSlug(band.code || band.name);
    const next = { ...band, id };
    const errors = validateLineup(next.defaultLineup ?? {}, next.constraints, ROLE_ORDER, next.roleConstraints);
    if (errors.length > 0) {
      setStatus(errors.join(' '));
      return;
    }
    await invoke('upsert_library_band', { band: next });
    initialRef.current = JSON.stringify(next);
    setBand(next);
    setStatus('Saved.');
  }, [band]);
  return (
    <section className="panel">
      <div className="panel__header"><h2>{isNew ? 'New Band' : `Band: ${band.name}`}</h2></div>
      <div className="form-grid">
        <label>Name<input value={band.name} onChange={(e) => setBand({ ...band, name: e.target.value })} /></label>
        <label>Code<input value={band.code} onChange={(e) => setBand({ ...band, code: e.target.value })} /></label>
        <label>Description<input value={band.description ?? ''} onChange={(e) => setBand({ ...band, description: e.target.value })} /></label>
      </div>
      <article className="lineup-card"><div className="panel__header"><h3>Members</h3><button type="button" className="button-secondary" onClick={() => {
        const first = musicians[0]; if (!first) return;
        setBand({ ...band, members: [...band.members, { musicianId: first.id, roles: ['vocs'], isDefault: false }] });
      }}>+ Add member</button></div>
        <div className="lineup-list">{band.members.map((member, index) => (
          <div key={`${member.musicianId}-${index}`} className="lineup-list__row"><span>{musicians.find((m) => m.id === member.musicianId)?.name ?? member.musicianId}</span><span>{member.roles.join(', ')}</span><button type="button" className="button-secondary" onClick={() => setBand({ ...band, members: band.members.filter((_, idx) => idx !== index) })}>Remove</button></div>
        ))}</div></article>
      <article className="lineup-card"><div className="panel__header"><h3>Default lineup</h3></div>
        <div className="lineup-grid">{ROLE_ORDER.map((role) => {
          const constraint = normalizeRoleConstraint(role, band.constraints[role]);
          const slots = normalizeLineupValue((band.defaultLineup ?? {})[role], constraint.max);
          return <div key={role} className="lineup-card"><strong>{getRoleDisplayName(role, band.constraints, band.roleConstraints)}</strong>{Array.from({ length: Math.max(constraint.max, 1) }).map((_, idx) => <div key={idx} className="lineup-list__row"><span>{musicians.find((m) => m.id === slots[idx])?.name ?? 'Not set'}</span><button type="button" className="button-secondary" onClick={() => {
            const selected = musicians[idx % Math.max(musicians.length, 1)];
            if (!selected) return;
            const current = normalizeLineupValue((band.defaultLineup ?? {})[role], constraint.max);
            while (current.length < Math.max(constraint.max, idx + 1)) current.push('');
            current[idx] = selected.id;
            setBand({ ...band, defaultLineup: { ...(band.defaultLineup ?? {}), [role]: constraint.max === 1 ? current[0] : current.filter(Boolean) } });
          }}>Change</button></div>)}</div>;
        })}</div></article>
      <article className="lineup-card"><div className="panel__header"><h3>Contacts</h3><button type="button" className="button-secondary" onClick={() => setBand({ ...band, contacts: [...band.contacts, { id: crypto.randomUUID(), name: 'New Contact' }] })}>+ Add contact</button></div>
        {band.contacts.map((contact) => <div key={contact.id} className="lineup-list__row"><input value={contact.name} onChange={(e) => setBand({ ...band, contacts: band.contacts.map((item) => item.id === contact.id ? { ...item, name: e.target.value } : item) })} /><button type="button" className="button-secondary" onClick={() => setBand({ ...band, contacts: band.contacts.filter((item) => item.id !== contact.id) })}>Remove</button></div>)}</article>
      <article className="lineup-card"><div className="panel__header"><h3>Messages</h3><button type="button" className="button-secondary" onClick={() => setBand({ ...band, messages: [...band.messages, { id: crypto.randomUUID(), name: 'New Message', body: '' }] })}>+ Add message</button></div>
        {band.messages.map((message) => <label key={message.id}>{message.name}<textarea value={message.body} onChange={(e) => setBand({ ...band, messages: band.messages.map((item) => item.id === message.id ? { ...item, body: e.target.value } : item) })} /></label>)}</article>
      {status ? <p className="status status--error">{status}</p> : null}
      <div className="setup-action-bar"><button type="button" className="button-secondary" onClick={() => navigate('/library/bands')}>Back</button><button type="button" className="button-secondary" onClick={() => navigate('/library/bands')}>Cancel</button><button type="button" onClick={async () => { await saveBand(); navigate('/library/bands'); }}>Save</button></div>
    </section>
  );
}

function LibraryMusiciansPage({ registerNavigationGuard }: LibraryPageProps) {
  const [items, setItems] = useState<LibraryMusician[]>([]);
  const [editing, setEditing] = useState<LibraryMusician | null>(null);
  const [draft, setDraft] = useState<LibraryMusician | null>(null);
  const [status, setStatus] = useState('');
  const isDirty = Boolean(editing && draft && JSON.stringify(editing) !== JSON.stringify(draft));
  useEffect(() => { invoke<LibraryMusician[]>('list_library_musicians').then(setItems).catch(() => setStatus('Failed to load musicians')); }, []);
  useEffect(() => { registerNavigationGuard(editing ? { isDirty: () => isDirty, save: async () => { if (draft) await invoke('upsert_library_musician', { musician: draft }); } } : null); return () => registerNavigationGuard(null); }, [editing, isDirty, draft, registerNavigationGuard]);
  return <LibrarySimpleEntityPage title="Musicians" status={status} onCreate={() => { const next = { id: crypto.randomUUID(), name: '', defaultRoles: [], notes: '' }; setEditing(next); setDraft(next); }} rows={items.map((item) => ({ id: item.id, name: item.name, detail: item.defaultRoles.join(', ') }))} onEdit={(id) => { const selected = items.find((item) => item.id === id); if (!selected) return; setEditing(selected); setDraft({ ...selected }); }} onDelete={async (id) => { await invoke('delete_library_musician', { musicianId: id }); setItems(await invoke<LibraryMusician[]>('list_library_musicians')); }} modal={draft ? <div className="form-grid"><label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Gender<input value={draft.gender ?? ''} onChange={(e) => setDraft({ ...draft, gender: e.target.value })} /></label><label>Default roles<input value={draft.defaultRoles.join(', ')} onChange={(e) => setDraft({ ...draft, defaultRoles: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /></label><label>Notes<textarea value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</button><button type="button" onClick={async () => { if (!draft) return; await invoke('upsert_library_musician', { musician: { ...draft, id: draft.id || toIdSlug(draft.name) } }); setItems(await invoke<LibraryMusician[]>('list_library_musicians')); setEditing(null); setDraft(null); }}>Save</button></div></div> : null} onCloseModal={() => { setEditing(null); setDraft(null); }} />;
}

function LibrarySimpleEntityPage({
  title,
  status,
  onCreate,
  rows,
  onEdit,
  onDelete,
  modal,
  onCloseModal,
}: {
  title: string;
  status: string;
  onCreate: () => void;
  rows: { id: string; name: string; detail?: string }[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  modal: ReactNode;
  onCloseModal: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel__header"><h2>{title}</h2><button type="button" onClick={onCreate}>+ New</button></div>
      {status ? <p className="status status--error">{status}</p> : null}
      <div className="library-table">
        {rows.map((row) => (
          <div key={row.id} className="library-row"><span>{row.name}</span><span>{row.detail || '—'}</span><div className="project-actions"><button type="button" className="button-secondary" onClick={() => onEdit(row.id)}>Edit</button><button type="button" className="button-secondary" onClick={() => onDelete(row.id)}>Delete</button></div></div>
        ))}
      </div>
      <ModalOverlay open={Boolean(modal)} onClose={onCloseModal}><div className="selector-dialog"><button type="button" className="modal-close" onClick={onCloseModal}>×</button>{modal}</div></ModalOverlay>
    </section>
  );
}

function LibraryEntityCrud({
  title,
  listCommand,
  upsertCommand,
  deleteCommand,
  registerNavigationGuard,
  multiline = false,
}: {
  commandPrefix: string;
  title: string;
  listCommand: string;
  upsertCommand: string;
  deleteCommand: string;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
  multiline?: boolean;
}) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const isDirty = Boolean(editing && draft && JSON.stringify(editing) !== JSON.stringify(draft));
  useEffect(() => { invoke<Array<Record<string, unknown>>>(listCommand).then(setItems).catch(() => undefined); }, [listCommand]);
  useEffect(() => { registerNavigationGuard(editing ? { isDirty: () => isDirty, save: async () => { if (draft) await invoke(upsertCommand, Object.fromEntries([[upsertCommand.includes('message') ? 'messageItem' : upsertCommand.includes('contact') ? 'contact' : 'instrument', draft]])); } } : null); return () => registerNavigationGuard(null); }, [editing, draft, isDirty, registerNavigationGuard, upsertCommand]);
  const upsertArgName = upsertCommand.includes('message') ? 'messageItem' : upsertCommand.includes('contact') ? 'contact' : 'instrument';
  const deleteArgName = deleteCommand.includes('message') ? 'messageId' : deleteCommand.includes('contact') ? 'contactId' : 'instrumentId';
  return <LibrarySimpleEntityPage title={title} status="" onCreate={() => { const next = { id: crypto.randomUUID(), name: '', body: '', channels: 1, key: '' }; setEditing(next); setDraft(next); }} rows={items.map((item) => ({ id: String(item.id), name: String(item.name ?? item.id), detail: String(item.key ?? item.email ?? item.body ?? '') }))} onEdit={(id) => { const selected = items.find((item) => String(item.id) === id); if (!selected) return; setEditing(selected); setDraft({ ...selected }); }} onDelete={async (id) => { await invoke(deleteCommand, { [deleteArgName]: id }); setItems(await invoke<Array<Record<string, unknown>>>(listCommand)); }} modal={draft ? <div className="form-grid"><label>Name<input value={String(draft.name ?? '')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>ID<input value={String(draft.id ?? '')} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>{multiline ? <label>Body<textarea value={String(draft.body ?? '')} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label> : <label>Details<input value={String((draft.key ?? draft.email ?? draft.notes) ?? '')} onChange={(e) => setDraft({ ...draft, key: e.target.value, email: e.target.value, notes: e.target.value })} /></label>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</button><button type="button" onClick={async () => { if (!draft) return; await invoke(upsertCommand, { [upsertArgName]: draft }); setItems(await invoke<Array<Record<string, unknown>>>(listCommand)); setEditing(null); setDraft(null); }}>Save</button></div></div> : null} onCloseModal={() => { setEditing(null); setDraft(null); }} />;
}

function LibraryInstrumentsPage({ registerNavigationGuard }: LibraryPageProps) { return <LibraryEntityCrud commandPrefix="instrument" title="Instruments" listCommand="list_library_instruments" upsertCommand="upsert_library_instrument" deleteCommand="delete_library_instrument" registerNavigationGuard={registerNavigationGuard} />; }
function LibraryContactsPage({ registerNavigationGuard }: LibraryPageProps) { return <LibraryEntityCrud commandPrefix="contact" title="Contacts" listCommand="list_library_contacts" upsertCommand="upsert_library_contact" deleteCommand="delete_library_contact" registerNavigationGuard={registerNavigationGuard} />; }
function LibraryMessagesPage({ registerNavigationGuard }: LibraryPageProps) { return <LibraryEntityCrud commandPrefix="message" title="Messages" listCommand="list_library_messages" upsertCommand="upsert_library_message" deleteCommand="delete_library_message" registerNavigationGuard={registerNavigationGuard} multiline />; }


function ExportResultModal({
  state,
  onClose,
  onRetry,
  onGoToHub,
}: {
  state: ExportModalState;
  onClose: () => void;
  onRetry: () => void;
  onGoToHub: () => void;
}) {
  if (!state) return null;
  const isSuccess = state.kind === "success";
  const dialogRef = useModalBehavior(Boolean(state), onClose);
  return (
    <ModalOverlay open={Boolean(state)} onClose={onClose}>
      <div
        className="selector-dialog"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h3>{isSuccess ? "Export complete" : "Export failed"}</h3>
        {isSuccess ? (
          <p>PDF was saved successfully.</p>
        ) : (
          <>
            <p>
              Something went wrong during export. If this file is open in
              another program (or preview), close it and retry.
            </p>
            <p className="subtle">
              {state.message}
              {state.technical ? ` — ${state.technical}` : ""}
            </p>
          </>
        )}
        <div className="modal-actions">
          {isSuccess ? (
            <>
              <button
                type="button"
                className="button-secondary"
                onClick={() => invoke("open_file", { path: state.path })}
              >
                Open file
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  invoke("reveal_in_explorer", { path: state.path })
                }
              >
                Open folder
              </button>
              <button type="button" onClick={onGoToHub}>
                Go to Project Hub
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="button-secondary"
                onClick={onRetry}
              >
                Retry
              </button>
              <button type="button" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

function UnsavedChangesModal({
  open,
  onSaveAndExit,
  onExitWithoutSaving,
  onStay,
}: {
  open: boolean;
  onSaveAndExit: () => void | Promise<void>;
  onExitWithoutSaving: () => void;
  onStay: () => void;
}) {
  const dialogRef = useModalBehavior(open, onStay);
  return (
    <ModalOverlay open={open} onClose={onStay} className="selector-overlay--topmost">
      <div
        className="selector-dialog"
        role="alertdialog"
        aria-modal="true"
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onStay}
          aria-label="Close"
        >
          ×
        </button>
        <h3>Unsaved changes</h3>
        <p>You have unsaved changes. What would you like to do?</p>
        <div className="modal-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={onSaveAndExit}
          >
            Save & exit
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onExitWithoutSaving}
          >
            Exit without saving
          </button>
          <button type="button" onClick={onStay}>
            Stay
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useModalBehavior(open, onClose);
  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div
        className="selector-dialog about-dialog"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h3>About StagePilot</h3>
        <div className="about-grid">
          <p className="about-item">
            <span>StagePilot</span>
            <strong>Desktop</strong>
          </p>
          <p className="about-item">
            <span>Author</span>
            <strong>Matěj Krečmer</strong>
          </p>
          <p className="about-item">
            <span>Version</span>
            <strong>{desktopPackage.version}</strong>
          </p>
          <p className="about-item">
            <span>Copyright</span>
            <strong>© 2026 StagePilot</strong>
          </p>
          <p className="about-item">
            <span>Channel</span>
            <strong>Preview</strong>
          </p>
          <p className="about-item">
            <span>Build Date</span>
            <strong>{new Date().toLocaleDateString()}</strong>
          </p>
        </div>
      </div>
    </ModalOverlay>
  );
}

function ProjectPreviewPage({
  id,
  navigate,
  registerNavigationGuard,
  search = "",
}: ProjectRouteProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState("");
  const [previewState, setPreviewState] = useState<PreviewState>({
    kind: "idle",
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportModal, setExportModal] = useState<ExportModalState>(null);
  const hasGeneratedOnEntry = useRef(false);

  function releasePreviewUrl() {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  }

  const regeneratePreview = useCallback(async () => {
    setPreviewState({ kind: "generating" });
    setStatus("");
    releasePreviewUrl();
    try {
      const result = await invoke<{ previewPdfPath: string }>(
        "build_project_pdf_preview",
        { projectId: id },
      );
      console.info("[preview] generated", {
        previewPath: result.previewPdfPath,
      });
      const bytes = await invoke<number[]>("read_preview_pdf_bytes", {
        previewPdfPath: result.previewPdfPath,
      });
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });
      const nextUrl = URL.createObjectURL(blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setPreviewState({ kind: "ready", path: result.previewPdfPath });
    } catch (err) {
      const message =
        (err as ApiError)?.message ?? "Failed to generate preview.";
      setStatus(`Preview failed: ${message}`);
      const missingPreview = message.includes("os error 2");
      setPreviewState({
        kind: "error",
        message: missingPreview
          ? "Preview is no longer available because the temporary file was removed after export. Generate preview again."
          : `Preview failed: ${message}`,
        missingPreview,
      });
    }
  }, [id]);

  useEffect(() => {
    invoke<string>("read_project", { projectId: id })
      .then((raw) => setProject(JSON.parse(raw) as NewProjectPayload))
      .catch(() => setStatus("Failed to load project."));
  }, [id]);

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => false,
      save: async () => undefined,
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard]);

  useEffect(() => {
    hasGeneratedOnEntry.current = false;
  }, [id]);

  useEffect(() => {
    if (!hasGeneratedOnEntry.current) {
      hasGeneratedOnEntry.current = true;
      regeneratePreview();
    }
    return () => {
      releasePreviewUrl();
      // Uses slug (human doc key), not id (UUID).
      invoke("cleanup_preview_pdf", { previewKey: project?.slug || id }).catch(() => undefined);
    };
  }, [id, regeneratePreview]);

  const runExport = useCallback(async () => {
    if (!project) return;
    try {
      setIsGeneratingPdf(true);
      const selectedPath = await invoke<string | null>("pick_export_pdf_path", {
        // Uses slug (human doc key), not id (UUID).
        defaultFileName: buildExportFileName(project.slug || project.id),
      });
      if (!selectedPath) return;
      await invoke("export_pdf_to_path", {
        projectId: project.id,
        outputPath: selectedPath,
      });
      setExportModal({ kind: "success", path: selectedPath });
    } catch (err) {
      const message = (err as ApiError)?.message ?? "unknown error";
      setExportModal({ kind: "error", message });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [project]);

  const previewRoute = `${window.location.pathname}${search || ""}`;
  const backToEditPath =
    project?.purpose === "generic"
      ? withFrom(`/projects/${id}/generic`, "pdfPreview", previewRoute)
      : withFrom(`/projects/${id}/event`, "pdfPreview", previewRoute);

  return (
    <section className="panel panel--preview">
      <div className="panel__header">
        <h2>PDF Preview</h2>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
        >
          Back to Hub
        </button>
      </div>
      <div className="pdf-preview-panel">
        <div className="preview-container">
          {previewState.kind === "generating" ||
            previewState.kind === "idle" ? (
            <p className="subtle">Generating preview…</p>
          ) : null}
          {previewState.kind === "ready" && previewUrl ? (
            <iframe
              className="pdf-preview-object"
              src={previewUrl}
              title="PDF preview"
            />
          ) : null}
          {previewState.kind === "error" ? (
            <div className="status status--error">
              <p>{previewState.message || status || "Preview failed."}</p>
              <button
                type="button"
                className="button-secondary"
                onClick={regeneratePreview}
              >
                {previewState.missingPreview
                  ? "Generate preview again"
                  : "Retry"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="setup-action-bar setup-action-bar--equal">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate(backToEditPath)}
        >
          Edit Project
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() =>
            navigate(withFrom(`/projects/${id}/setup`, "preview", previewRoute))
          }
        >
          Edit Lineup
        </button>
        <button type="button" disabled={isGeneratingPdf} onClick={runExport}>
          {isGeneratingPdf ? "Generating…" : "Generate PDF"}
        </button>
      </div>
      <ExportResultModal
        state={exportModal}
        onClose={() => setExportModal(null)}
        onRetry={runExport}
        onGoToHub={() => {
          setExportModal(null);
          navigate("/");
        }}
      />
    </section>
  );
}

export default AppShell;
