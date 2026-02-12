import { invoke } from "@tauri-apps/api/core";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import stagePilotIcon from "../assets/icons/StagePilot_Icon_StageLayout_CurrentColor.svg";
import desktopPackage from "../package.json";
import {
  type LineupMap,
  type RoleConstraint,
  type RoleLabelConstraints,
  buildExportFileName,
  formatProjectDisplayName,
  formatProjectSlug,
  formatIsoDateToUs,
  formatIsoToDateTimeDisplay,
  getCurrentYearLocal,
  getTodayIsoLocal,
  getUniqueSelectedMusicians,
  getRoleDisplayName,
  isPastIsoDate,
  isValidityYearInPast,
  matchLibraryBandDetailPath,
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  normalizeLineupValue,
  normalizeRoleConstraint,
  parseUsDateInput,
  resolveBandLeaderId,
  resolveTalkbackOwnerId,
  validateLineup,
} from "./projectRules";
import { generateUuidV7, isUuidV7 } from "../../../src/domain/projectNaming";
import "./App.css";

type ProjectSummary = {
  id: string;
  slug?: string | null;
  displayName?: string | null;
  bandRef?: string | null;
  eventDate?: string | null;
  eventVenue?: string | null;
  purpose?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
};
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

let modalOpenCount = 0;
function useModalBehavior(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    modalOpenCount += 1;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    return () => {
      modalOpenCount -= 1;
      if (modalOpenCount <= 0) {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPaddingRight;
        modalOpenCount = 0;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return dialogRef;
}

function App() {
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
        .map((band) => [band.code!.trim().toLowerCase(), band]),
    );
    const listed = await invoke<ProjectSummary[]>("list_projects");
    const migratedIds = new Map<string, string>();
    for (const summary of listed) {
      const raw = await invoke<string>("read_project", { projectId: summary.id });
      const parsedRaw = JSON.parse(raw) as NewProjectPayload & Record<string, unknown>;
      const { legacyId: _legacyId, ...withoutLegacy } = parsedRaw as NewProjectPayload & {
        legacyId?: unknown;
      };
      const project = withoutLegacy as NewProjectPayload;

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
      if (!needsIdMigration && !needsBandRefMigration && !needsNameMigration && !hasLegacyId) continue;

      const legacyId = summary.id;
      const nextId = needsIdMigration ? generateUuidV7() : project.id;
      const migrated: NewProjectPayload = {
        ...(project as Omit<NewProjectPayload, "id" | "slug" | "displayName" | "bandRef">),
        id: nextId,
        slug,
        displayName,
        bandRef: canonicalBandRef,
        updatedAt: new Date().toISOString(),
      };
      const nextSlug = migrated.slug || "";
      await invoke("save_project", {
        projectId: nextId,
        legacyProjectId: legacyId,
        json: JSON.stringify(toPersistableProject(migrated), null, 2),
      });
      migratedIds.set(legacyId, nextId);
      console.info(`project=${nextId} slug=${nextSlug} migrated=true`);
    }

    const refreshed = await invoke<ProjectSummary[]>("list_projects");
    setProjects(refreshed);
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
          className="button-secondary"
          onClick={() => setIsAboutOpen(true)}
          aria-label="About StagePilot"
        >
          ℹ️
        </button>
      </header>
      <TopTabs pathname={pathname} navigate={navigate} />
      {status ? <p className="status status--error">{status}</p> : null}
      {pathname === "/" ? (
        <StartPage projects={projects} navigate={navigate} />
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

function TopTabs({
  pathname,
  navigate,
}: {
  pathname: string;
  navigate: (path: string) => void;
}) {
  const current = pathname.startsWith("/library")
    ? "library"
    : pathname.startsWith("/settings")
      ? "settings"
      : "projects";
  return (
    <nav className="top-tabs" aria-label="Primary">
      <button
        type="button"
        className={current === "projects" ? "button-secondary is-active" : "button-secondary"}
        onClick={() => navigate("/")}
      >
        Projects
      </button>
      <button
        type="button"
        className={current === "library" ? "button-secondary is-active" : "button-secondary"}
        onClick={() => navigate("/library")}
      >
        Library
      </button>
      <button
        type="button"
        className={current === "settings" ? "button-secondary is-active" : "button-secondary"}
        onClick={() => navigate("/settings")}
      >
        Settings
      </button>
    </nav>
  );
}

function SettingsPage() {
  return (
    <section className="panel">
      <div className="panel__header panel__header--stack">
        <h2>Settings</h2>
        <p className="subtle">Settings will be available in a future update.</p>
      </div>
    </section>
  );
}

function LibraryHomePage({ navigate }: { navigate: (path: string) => void }) {
  const items = [
    ["Bands", "/library/bands"],
    ["Musicians", "/library/musicians"],
    ["Instruments", "/library/instruments"],
    ["Contacts", "/library/contacts"],
    ["Messages", "/library/messages"],
  ];
  return (
    <section className="panel">
      <div className="panel__header panel__header--stack">
        <h2>Library</h2>
        <p className="subtle">Manage reusable bands, musicians, instruments, contacts, and message templates.</p>
      </div>
      <div className="project-list">
        {items.map(([label, path]) => (
          <button key={path} type="button" className="project-card project-surface" onClick={() => navigate(path)}>
            <strong>{label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

type StartPageProps = {
  projects: ProjectSummary[];
  navigate: (path: string) => void;
};
function StartPage({ projects, navigate }: StartPageProps) {
  const [viewMode, setViewMode] = useState<"list" | "tiles">(() =>
    localStorage.getItem("project-hub-view") === "tiles" ? "tiles" : "list",
  );

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
  const recentProjects = sortedProjects.slice(0, 5);
  const olderProjects = sortedProjects.slice(5);

  function projectEditPath(project: ProjectSummary) {
    const encodedId = encodeURIComponent(project.id);
    const route =
      project.purpose === "event"
        ? `/projects/${encodedId}/event`
        : `/projects/${encodedId}/generic`;
    return `${route}?from=home`;
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
      {sortedProjects.length === 0 ? (
        <p className="subtle">No projects found.</p>
      ) : (
        <div className="project-sections">
          <section className="project-section">
            <p className="subtle project-section__label">Recent</p>
            <div
              className={
                viewMode === "list"
                  ? "project-list project-list--rows"
                  : "project-list"
              }
            >
              {recentProjects.map((project) => (
                <article
                  key={project.id}
                  className={
                    viewMode === "list"
                      ? "project-card project-card--list project-surface"
                      : "project-card project-surface"
                  }
                >
                  <div className="project-main-action project-main-action__content">
                    <strong>{project.displayName || project.slug || project.id}</strong>
                    <span>{getProjectPurposeLabel(project.purpose)}</span>
                    <span>Last updated: {formatProjectDate(project)}</span>
                  </div>
                  <div className="project-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={`Edit ${project.displayName || project.slug || project.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(projectEditPath(project));
                      }}
                    >
                      <span aria-hidden="true">✏️</span>
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={`Open PDF preview for ${project.displayName || project.slug || project.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(
                          withFrom(
                            `/projects/${encodeURIComponent(project.id)}/preview`,
                            "home",
                          ),
                        );
                      }}
                    >
                      <span aria-hidden="true">📄</span>
                      <span>Preview</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          {olderProjects.length > 0 ? (
            <section className="project-section">
              <p className="subtle project-section__label">Older</p>
              <div
                className={
                  viewMode === "list"
                    ? "project-list project-list--rows"
                    : "project-list"
                }
              >
                {olderProjects.map((project) => (
                  <article
                    key={project.id}
                    className={
                      viewMode === "list"
                        ? "project-card project-card--list project-surface"
                        : "project-card project-surface"
                    }
                  >
                    <div className="project-main-action project-main-action__content">
                      <strong>{project.displayName || project.slug || project.id}</strong>
                      <span>{getProjectPurposeLabel(project.purpose)}</span>
                      <span>Last updated: {formatProjectDate(project)}</span>
                    </div>
                    <div className="project-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        aria-label={`Edit ${project.displayName || project.slug || project.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(projectEditPath(project));
                        }}
                      >
                        <span aria-hidden="true">✏️</span>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        aria-label={`Open PDF preview for ${project.displayName || project.slug || project.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(
                            withFrom(
                              `/projects/${encodeURIComponent(project.id)}/preview`,
                              "home",
                            ),
                          );
                        }}
                      >
                        <span aria-hidden="true">📄</span>
                        <span>Preview</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </section>
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
  onInput,
  onIsoSelect,
  onBlur,
  inputId,
}: {
  value: string;
  isoValue: string;
  minIso: string;
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
          inputMode="text"
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
              const isDisabled = day.iso < minIso;
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
  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(
    eventDateIso &&
      !isPastIsoDate(eventDateIso, todayIso) &&
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
    const parsed = parseUsDateInput(value);
    if (!parsed) return "Invalid date. Use DD/MM/YYYY.";
    if (isPastIsoDate(parsed, todayIso)) return "Date cannot be in the past.";
    return "";
  }

  function updateDateInput(value: string) {
    setEventDateInput(value);
    const parsed = parseUsDateInput(value);
    const message = getDateValidationMessage(value);
    if (eventDateTouched) setEventDateError(message);
    setEventDateIso(!parsed || message ? "" : parsed);
  }

  const isDirty = isSetupInfoDirty(initialSnapshotRef.current, {
    date: eventDateIso,
    venue: eventVenue.trim(),
    bandRef,
  });

  const persist = useCallback(async () => {
    if (!selectedBand || !eventDateIso || !eventVenue.trim()) return;
    const namingSource = { purpose: "event" as const, eventDate: eventDateIso, eventVenue, documentDate: todayIso };
    const slug = formatProjectSlug(namingSource, selectedBand);
    const displayName = formatProjectDisplayName(namingSource, selectedBand);
    const id = editingProjectId ?? generateUuidV7();
    const nowIso = new Date().toISOString();
    const payload: NewProjectPayload = {
      id,
      slug,
      displayName,
      purpose: "event",
      eventDate: eventDateIso,
      eventVenue: eventVenue.trim(),
      bandRef: selectedBand.id,
      documentDate: todayIso,
      createdAt: existingProject?.createdAt ?? nowIso,
      updatedAt: nowIso,
      lineup: existingProject?.lineup,
      bandLeaderId: existingProject?.bandLeaderId,
      talkbackOwnerId: existingProject?.talkbackOwnerId,
      note: existingProject?.note,
    };
    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(toPersistableProject(payload), null, 2),
    });
    await onCreated();
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
      save: persist,
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
    await persist();
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
  const currentYear = getCurrentYearLocal();
  const [year, setYear] = useState(String(currentYear));
  const [note, setNote] = useState("");
  const [bandRef, setBandRef] = useState("");
  const [status, setStatus] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const initialSnapshotRef = useRef({ date: "", venue: "", bandRef: "" });
  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(
    selectedBand &&
      /^\d{4}$/.test(year) &&
      !isValidityYearInPast(year, currentYear),
  );

  useEffect(() => {
    if (!editingProjectId) return;
    invoke<string>("read_project", { projectId: editingProjectId })
      .then((raw) => {
        const project = JSON.parse(raw) as NewProjectPayload;
        setBandRef(project.bandRef);
        setNote(project.note ?? "");
        setYear(project.documentDate.slice(0, 4));
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

  const persist = useCallback(async () => {
    if (!selectedBand) return;
    const id = editingProjectId ?? generateUuidV7();
    const nowIso = new Date().toISOString();
    const payload: NewProjectPayload = {
      id,
      slug: formatProjectSlug({ purpose: "generic", documentDate: `${year}-01-01`, note }, selectedBand),
      displayName: formatProjectDisplayName({ purpose: "generic", documentDate: `${year}-01-01`, note }, selectedBand),
      purpose: "generic",
      bandRef: selectedBand.id,
      documentDate: `${year}-01-01`,
      ...(note.trim() ? { note: note.trim() } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(toPersistableProject(payload), null, 2),
    });
    await onCreated();
  }, [editingProjectId, note, onCreated, selectedBand, year]);

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => !isCommitting && isDirty,
      save: persist,
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, persist, isCommitting]);

  async function createProject() {
    if (!selectedBand) return;
    const id = editingProjectId ?? generateUuidV7();
    setIsCommitting(true);
    await persist();
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
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label>
          Validity year *
          <input
            type="number"
            min={currentYear}
            max="2100"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setStatus("");
            }}
          />
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
      const data = await invoke<BandSetupData>("get_band_setup_data", {
        bandId: parsed.bandRef,
      });
      setProject(parsed);
      setSetupData(data);
      const initialLineup = { ...(parsed.lineup ?? data.defaultLineup ?? {}) };
      applyState(
        initialLineup,
        data,
        parsed.bandLeaderId,
        parsed.talkbackOwnerId,
      );
      initialSnapshotRef.current = JSON.stringify(
        buildSetupSnapshot(
          initialLineup,
          data,
          parsed.bandLeaderId,
          parsed.talkbackOwnerId,
        ),
      );
    })().catch(() => setStatus("Failed to load setup."));
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

  function updateSlot(role: string, slotIndex: number, musicianId: string) {
    if (!setupData) return;
    const constraint = normalizeRoleConstraint(
      role,
      setupData.constraints[role],
    );
    const current = normalizeLineupValue(lineup[role], constraint.max);
    while (current.length < Math.max(constraint.max, slotIndex + 1))
      current.push("");
    current[slotIndex] = musicianId;
    const nextLineup = {
      ...lineup,
      [role]:
        constraint.max <= 1
          ? current.filter(Boolean)[0]
          : current.filter(Boolean),
    };
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  const backSetupPath =
    project?.purpose === "generic"
      ? `/projects/${encodeURIComponent(id)}/generic`
      : `/projects/${encodeURIComponent(id)}/event`;
  const fromPath = useMemo(
    () => new URLSearchParams(search).get("fromPath"),
    [search],
  );
  const navigationContext = useMemo(
    () =>
      getNavigationContextLabel(new URLSearchParams(search).get("from")) ||
      "Project Setup",
    [search],
  );
  const bandName = project?.displayName ?? setupData?.name ?? project?.bandRef ?? "—";
  const summarySecondary =
    project?.purpose === "event"
      ? [
          project.eventDate ? formatIsoDateToUs(project.eventDate) : "",
          project.eventVenue ?? "",
        ]
          .filter(Boolean)
          .join(" • ")
      : [project?.documentDate?.slice(0, 4) ?? "", project?.note ?? ""]
          .filter(Boolean)
          .join(" • ");
  const resetModalRef = useModalBehavior(showResetConfirmation, () =>
    setShowResetConfirmation(false),
  );
  const musicianSelectorRef = useModalBehavior(
    Boolean(editing && setupData),
    () => setEditing(null),
  );

  return (
    <section className="panel panel--setup">
      <div className="panel__header">
        <h1>Lineup Setup</h1>
      </div>
      <p className="subtle page-context">Opened from: {navigationContext}</p>
      <div className="lineup-meta">
        <div className="band-name">{bandName}</div>
        <div className="band-meta">{summarySecondary || "—"}</div>
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
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          : null}
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
      {errors.length > 0 ? (
        <div className="status status--error">
          {errors.map((error) => (
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
            if (errors.length > 0) return;
            if (isDirty) {
              setIsCommitting(true);
              await persistProject();
            }
            navigate(withFrom(`/projects/${id}/preview`, "setup"));
          }}
          disabled={errors.length > 0}
        >
          {isDirty ? "Save & Continue" : "Continue"}
        </button>
      </div>

      {showResetConfirmation ? (
        <dialog
          className="selector-overlay modal-backdrop"
          open
          onCancel={(event) => {
            event.preventDefault();
            setShowResetConfirmation(false);
          }}
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
        </dialog>
      ) : null}

      {editing && setupData ? (
        <dialog
          className="selector-overlay modal-backdrop"
          open
          onCancel={(event) => {
            event.preventDefault();
            setEditing(null);
          }}
        >
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
        </dialog>
      ) : null}
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
      {modal ? <dialog className="selector-overlay modal-backdrop" open onCancel={(e)=>{e.preventDefault(); onCloseModal();}}><div className="selector-dialog"><button type="button" className="modal-close" onClick={onCloseModal}>×</button>{modal}</div></dialog> : null}
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
    <dialog
      className="selector-overlay modal-backdrop"
      open
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
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
    </dialog>
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
  if (!open) return null;
  return createPortal(
    <dialog
      className="selector-overlay modal-backdrop selector-overlay--topmost"
      open
      onCancel={(event) => {
        event.preventDefault();
        onStay();
      }}
    >
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
    </dialog>,
    document.body,
  );
}

function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useModalBehavior(open, onClose);
  if (!open) return null;
  return (
    <dialog
      className="selector-overlay modal-backdrop"
      open
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
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
    </dialog>
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
  const navigationContext = useMemo(
    () => getNavigationContextLabel(new URLSearchParams(search).get("from")),
    [search],
  );

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
      {navigationContext ? (
        <p className="subtle page-context">Opened from: {navigationContext}</p>
      ) : null}
      <p className="subtle">{project?.slug || id}</p>
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
          Back to Edit Project
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() =>
            navigate(withFrom(`/projects/${id}/setup`, "preview", previewRoute))
          }
        >
          Back to Lineup
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

export default App;
