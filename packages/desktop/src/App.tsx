import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import stagePilotIcon from "../assets/icons/StagePilot_Icon_StageLayout_CurrentColor.svg";
import desktopPackage from "../package.json";
import {
  type LineupMap,
  type RoleConstraint,
  type RoleLabelConstraints,
  buildExportFileName,
  formatIsoDateToUs,
  formatIsoToDateTimeDisplay,
  getCurrentYearLocal,
  getTodayIsoLocal,
  getUniqueSelectedMusicians,
  getRoleDisplayName,
  isPastIsoDate,
  isValidityYearInPast,
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  normalizeCity,
  normalizeLineupValue,
  normalizeRoleConstraint,
  parseUsDateInput,
  resolveBandLeaderId,
  resolveTalkbackOwnerId,
  validateLineup,
} from "./projectRules";
import "./App.css";

type ProjectSummary = {
  id: string;
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

function formatDateForProjectId(eventDate: string) {
  const [year, month, day] = eventDate.split("-");
  if (!year || !month || !day)
    throw new Error(`Invalid event date: ${eventDate}`);
  return `${day}-${month}-${year}`;
}

function buildEventDisplayName(
  band: BandOption,
  eventDate: string,
  eventVenue: string,
) {
  return `${band.code?.trim() || band.id}_Inputlist_Stageplan_${formatDateForProjectId(eventDate)}_${normalizeCity(eventVenue) || "Venue"}`;
}

function buildGenericProjectId(band: BandOption, year: string) {
  return `${band.code?.trim() || band.id}_Inputlist_Stageplan_${year}`;
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
    setProjects(await invoke<ProjectSummary[]>("list_projects"));
  }, []);

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
                    <strong>{project.displayName || project.id}</strong>
                    <span>{getProjectPurposeLabel(project.purpose)}</span>
                    <span>Last updated: {formatProjectDate(project)}</span>
                  </div>
                  <div className="project-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      aria-label={`Edit ${project.displayName || project.id}`}
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
                      aria-label={`Open PDF preview for ${project.displayName || project.id}`}
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
                      <strong>{project.displayName || project.id}</strong>
                      <span>{getProjectPurposeLabel(project.purpose)}</span>
                      <span>Last updated: {formatProjectDate(project)}</span>
                    </div>
                    <div className="project-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        aria-label={`Edit ${project.displayName || project.id}`}
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
                        aria-label={`Open PDF preview for ${project.displayName || project.id}`}
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
    const displayName = buildEventDisplayName(
      selectedBand,
      eventDateIso,
      eventVenue,
    );
    const id = editingProjectId ?? displayName;
    const nowIso = new Date().toISOString();
    const payload: NewProjectPayload = {
      id,
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
      json: JSON.stringify(payload, null, 2),
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
    const id =
      editingProjectId ??
      buildEventDisplayName(selectedBand, eventDateIso, eventVenue);
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
    const id = editingProjectId ?? buildGenericProjectId(selectedBand, year);
    const nowIso = new Date().toISOString();
    const payload: NewProjectPayload = {
      id,
      displayName: buildGenericProjectId(selectedBand, year),
      purpose: "generic",
      bandRef: selectedBand.id,
      documentDate: `${year}-01-01`,
      ...(note.trim() ? { note: note.trim() } : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(payload, null, 2),
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
    const id = editingProjectId ?? buildGenericProjectId(selectedBand, year);
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
      json: JSON.stringify(payload, null, 2),
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
  const bandName = setupData?.name ?? project?.bandRef ?? "—";
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
      invoke("cleanup_preview_pdf", { projectId: id }).catch(() => undefined);
    };
  }, [id, regeneratePreview]);

  const runExport = useCallback(async () => {
    if (!project) return;
    try {
      setIsGeneratingPdf(true);
      const selectedPath = await invoke<string | null>("pick_export_pdf_path", {
        defaultFileName: buildExportFileName(project.id),
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
