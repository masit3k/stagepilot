import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import desktopPackage from "../package.json";
import {
  type LineupMap,
  type LineupValue,
  type RoleConstraint,
  autoFormatDateInput,
  formatIsoDateToUs,
  getTodayIsoLocal,
  getUniqueSelectedMusicians,
  isPastIsoDate,
  matchProjectDetailPath,
  matchProjectSetupPath,
  normalizeLineupValue,
  normalizeRoleConstraint,
  parseUsDateInput,
  validateLineup,
} from "./projectRules";
import "./App.css";

type ProjectSummary = {
  id: string;
  bandRef?: string | null;
  eventDate?: string | null;
  eventVenue?: string | null;
  purpose?: string | null;
  createdAt?: string | null;
};

type BandOption = {
  id: string;
  name: string;
  code?: string | null;
};

type MemberOption = {
  id: string;
  name: string;
};

type BandSetupData = {
  id: string;
  name: string;
  constraints: Record<string, RoleConstraint>;
  roleConstraints?: Record<string, unknown> | null;
  defaultLineup?: LineupMap | null;
  members: Record<string, MemberOption[]>;
};

type NewProjectPayload = {
  id: string;
  purpose: "event" | "generic";
  bandRef: string;
  documentDate: string;
  eventDate?: string;
  eventVenue?: string;
  note?: string;
  createdAt: string;
  lineup?: LineupMap;
  bandLeaderId?: string;
  talkbackOwnerId?: string;
};

const ROLE_ORDER = ["drums", "bass", "guitar", "keys", "vocs"];

function sanitizeVenueSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function formatDateForProjectId(eventDate: string): string {
  const [year, month, day] = eventDate.split("-");
  if (!year || !month || !day) {
    throw new Error(`Invalid event date: ${eventDate}`);
  }
  return `${day}-${month}-${year}`;
}

function buildEventProjectId(
  band: BandOption,
  eventDate: string,
  eventVenue: string,
): string {
  const code = band.code?.trim() || band.id;
  const date = formatDateForProjectId(eventDate);
  const venueSlug = sanitizeVenueSlug(eventVenue) || "venue";
  return `${code}_Inputlist_Stageplan_${date}_${venueSlug}`;
}

function buildGenericProjectId(band: BandOption, year: string): string {
  const code = band.code?.trim() || band.id;
  return `${code}_Inputlist_Stageplan_${year}`;
}

function formatProjectDate(project: ProjectSummary) {
  if (project.eventDate) return project.eventDate;
  if (!project.createdAt) return "—";
  return new Date(project.createdAt).toLocaleDateString();
}

function getCurrentPath() {
  return window.location.pathname || "/";
}

function App() {
  const [userDataDir, setUserDataDir] = useState<string>("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [bands, setBands] = useState<BandOption[]>([]);
  const [status, setStatus] = useState<string>("");
  const [pathname, setPathname] = useState<string>(getCurrentPath());

  function navigate(path: string) {
    window.history.pushState({}, "", path);
    setPathname(path);
  }

  const refreshProjects = useCallback(async () => {
    const list = await invoke<ProjectSummary[]>("list_projects");
    setProjects(list);
  }, []);

  const refreshBands = useCallback(async () => {
    const list = await invoke<BandOption[]>("list_bands");
    setBands(list);
  }, []);

  useEffect(() => {
    const handlePopState = () => setPathname(getCurrentPath());
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    async function bootstrap() {
      const dir = await invoke<string>("get_user_data_dir");
      setUserDataDir(dir);
      await Promise.all([refreshProjects(), refreshBands()]);
    }

    bootstrap().catch((err) => {
      console.error("bootstrap failed", {
        command: "get_user_data_dir/list_projects/list_bands",
        resolvedPath: "unknown",
        originalError: err,
      });
      setStatus("Failed to load band data. Check application logs.");
    });
  }, [refreshBands, refreshProjects]);

  const projectId = useMemo(() => matchProjectDetailPath(pathname), [pathname]);
  const setupProjectId = useMemo(
    () => matchProjectSetupPath(pathname),
    [pathname],
  );

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__icon-slot" aria-hidden="true" />
          <div>
            <h1>StagePilot</h1>
            <p className="subtle">Desktop v{desktopPackage.version}</p>
          </div>
        </div>
      </header>

      {status ? <p className="status status--error">{status}</p> : null}

      {pathname === "/" ? (
        <StartPage
          projects={projects}
          userDataDir={userDataDir}
          navigate={navigate}
          onOpenExisting={() => {
            setStatus("Open Existing is not implemented yet.");
          }}
        />
      ) : null}

      {pathname === "/projects/new" ? (
        <ChooseProjectTypePage navigate={navigate} />
      ) : null}

      {pathname === "/projects/new/event" ? (
        <NewEventProjectPage
          bands={bands}
          navigate={navigate}
          onCreated={async () => {
            await refreshProjects();
          }}
        />
      ) : null}

      {pathname === "/projects/new/generic" ? (
        <NewGenericProjectPage
          bands={bands}
          navigate={navigate}
          onCreated={async () => {
            await refreshProjects();
          }}
        />
      ) : null}

      {setupProjectId ? (
        <ProjectSetupPage id={setupProjectId} navigate={navigate} />
      ) : null}

      {projectId && !setupProjectId ? (
        <ProjectDetailPage id={projectId} navigate={navigate} />
      ) : null}
    </main>
  );
}

type StartPageProps = {
  projects: ProjectSummary[];
  userDataDir: string;
  navigate: (path: string) => void;
  onOpenExisting: () => void;
};

function StartPage({
  projects,
  userDataDir,
  navigate,
  onOpenExisting,
}: StartPageProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Project Hub</h2>
        {import.meta.env.DEV ? (
          <p className="subtle">
            {userDataDir ? `Data: ${userDataDir}` : "Loading user_data…"}
          </p>
        ) : null}
      </div>

      <h3>Projects</h3>

      <div className="actions-row">
        <button type="button" onClick={() => navigate("/projects/new")}>
          + New Project
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={onOpenExisting}
        >
          Open Existing
        </button>
      </div>

      {projects.length === 0 ? (
        <p className="subtle">No projects found.</p>
      ) : (
        <div className="project-list">
          {projects.map((project) => (
            <button
              type="button"
              key={project.id}
              className="project-card"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <strong>{project.id}</strong>
              <span>Purpose: {project.purpose ?? "—"}</span>
              <span>Date: {formatProjectDate(project)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

type NewProjectPageProps = {
  navigate: (path: string) => void;
  onCreated: () => Promise<void>;
  bands: BandOption[];
};

function ChooseProjectTypePage({
  navigate,
}: Pick<NewProjectPageProps, "navigate">) {
  return (
    <section className="panel panel--choice">
      <div className="panel__header panel__header--stack">
        <h2>New Project</h2>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
        >
          Back to projects
        </button>
      </div>

      <div className="choice-grid" aria-label="Project type options">
        <button
          type="button"
          className="choice-card"
          onClick={() => navigate("/projects/new/event")}
        >
          <span className="choice-card__title">Event project</span>
          <span className="choice-card__desc">
            For a specific show with date and venue.
          </span>
        </button>
        <button
          type="button"
          className="choice-card"
          onClick={() => navigate("/projects/new/generic")}
        >
          <span className="choice-card__title">Generic template</span>
          <span className="choice-card__desc">
            Reusable template for a season or tour.
          </span>
        </button>
      </div>
    </section>
  );
}

function NewEventProjectPage({
  navigate,
  onCreated,
  bands,
}: NewProjectPageProps) {
  const [eventDateIso, setEventDateIso] = useState<string>("");
  const [eventDateInput, setEventDateInput] = useState<string>("");
  const [eventVenue, setEventVenue] = useState<string>("");
  const [bandRef, setBandRef] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const todayIso = getTodayIsoLocal();
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(
    eventDateIso &&
      !isPastIsoDate(eventDateIso, todayIso) &&
      eventVenue.trim() &&
      selectedBand,
  );

  function updateDateInput(value: string) {
    const formatted = autoFormatDateInput(value);
    setEventDateInput(formatted);
    const parsed = parseUsDateInput(formatted);
    if (!parsed) {
      setEventDateIso("");
      return;
    }
    if (isPastIsoDate(parsed, todayIso)) {
      setEventDateIso("");
      return;
    }
    setEventDateIso(parsed);
  }

  function openCalendar() {
    if (!datePickerRef.current?.showPicker) return;
    datePickerRef.current.showPicker();
  }

  async function createProject() {
    if (!selectedBand || !eventDateIso || !eventVenue.trim()) {
      setStatus("Date, venue, and band are required.");
      return;
    }
    if (isPastIsoDate(eventDateIso, todayIso)) {
      setStatus("Date cannot be in the past.");
      return;
    }

    const id = buildEventProjectId(selectedBand, eventDateIso, eventVenue);
    const payload: NewProjectPayload = {
      id,
      purpose: "event",
      eventDate: eventDateIso,
      eventVenue: eventVenue.trim(),
      bandRef: selectedBand.id,
      documentDate: eventDateIso,
      createdAt: new Date().toISOString(),
    };

    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(payload, null, 2),
    });

    await onCreated();
    navigate(`/projects/${id}/setup`);
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>New Event Project</h2>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/projects/new")}
        >
          Back
        </button>
      </div>

      <div className="form-grid">
        <label>
          Date *
          <input
            type="text"
            inputMode="numeric"
            lang="en-GB"
            placeholder="DD/MM/YYYY"
            value={eventDateInput}
            onChange={(event) => updateDateInput(event.target.value)}
            onClick={openCalendar}
          />
          <input
            ref={datePickerRef}
            className="date-picker-proxy"
            type="date"
            lang="en-GB"
            min={todayIso}
            value={eventDateIso}
            onChange={(event) => {
              setEventDateIso(event.target.value);
              setEventDateInput(formatIsoDateToUs(event.target.value));
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="actions-row">
            <button
              type="button"
              className="button-secondary"
              onClick={() => updateDateInput(formatIsoDateToUs(todayIso))}
            >
              Today
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => updateDateInput("")}
            >
              Clear
            </button>
          </div>
        </label>

        <label>
          Venue *
          <input
            type="text"
            value={eventVenue}
            onChange={(event) => setEventVenue(event.target.value)}
            placeholder="Venue"
          />
        </label>

        <label>
          Band *
          <select
            value={bandRef}
            onChange={(event) => setBandRef(event.target.value)}
          >
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

      <div className="actions-row">
        <button type="button" onClick={createProject} disabled={!canSubmit}>
          Create
        </button>
      </div>
    </section>
  );
}

function NewGenericProjectPage({
  navigate,
  onCreated,
  bands,
}: NewProjectPageProps) {
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [note, setNote] = useState<string>("");
  const [bandRef, setBandRef] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const selectedBand = bands.find((band) => band.id === bandRef);
  const yearOk = /^\d{4}$/.test(year);
  const canSubmit = Boolean(selectedBand && yearOk);

  async function createProject() {
    if (!selectedBand || !yearOk) {
      setStatus("Band and validity year are required.");
      return;
    }

    const id = buildGenericProjectId(selectedBand, year);
    const payload: NewProjectPayload = {
      id,
      purpose: "generic",
      bandRef: selectedBand.id,
      documentDate: `${year}-01-01`,
      ...(note.trim() ? { note: note.trim() } : {}),
      createdAt: new Date().toISOString(),
    };

    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(payload, null, 2),
    });

    await onCreated();
    navigate(`/projects/${id}/setup`);
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>New Generic Project</h2>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/projects/new")}
        >
          Back
        </button>
      </div>

      <div className="form-grid">
        <label>
          Band *
          <select
            value={bandRef}
            onChange={(event) => setBandRef(event.target.value)}
          >
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
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note, tour name, or additional context"
          />
        </label>

        <label>
          Validity year *
          <input
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </label>
      </div>

      {status ? <p className="status status--error">{status}</p> : null}

      <div className="actions-row">
        <button type="button" onClick={createProject} disabled={!canSubmit}>
          Create
        </button>
      </div>
    </section>
  );
}

type ProjectDetailPageProps = {
  id: string;
  navigate: (path: string) => void;
};

function ProjectDetailPage({ id, navigate }: ProjectDetailPageProps) {
  return (
    <section className="panel">
      <h2>Project Detail</h2>
      <p>Project ID: {id}</p>
      <button type="button" onClick={() => navigate("/")}>
        Back to projects
      </button>
    </section>
  );
}

function ProjectSetupPage({ id, navigate }: ProjectDetailPageProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const [lineup, setLineup] = useState<LineupMap>({});
  const [editing, setEditing] = useState<{
    role: string;
    slotIndex: number;
  } | null>(null);
  const [bandLeaderId, setBandLeaderId] = useState<string>("");
  const [talkbackOwnerId, setTalkbackOwnerId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const getDefaultBandLeader = useCallback((data: BandSetupData): string => {
    if (!data.defaultLineup) return "";
    const preferredOrder = [...ROLE_ORDER, "talkback"];
    for (const role of preferredOrder) {
      const constraint = normalizeRoleConstraint(role, data.constraints[role]);
      const selected = normalizeLineupValue(
        data.defaultLineup[role],
        constraint.max,
      );
      if (selected[0]) return selected[0];
    }
    return "";
  }, []);

  useEffect(() => {
    async function load() {
      const raw = await invoke<string>("read_project", { projectId: id });
      const parsed = JSON.parse(raw) as NewProjectPayload;
      setProject(parsed);
      const data = await invoke<BandSetupData>("get_band_setup_data", {
        bandId: parsed.bandRef,
      });
      setSetupData(data);
      const defaultBandLeaderId = getDefaultBandLeader(data);
      setBandLeaderId(parsed.bandLeaderId ?? defaultBandLeaderId);
      setTalkbackOwnerId(parsed.talkbackOwnerId ?? "");

      if (!data.defaultLineup) {
        if (import.meta.env.DEV) {
          throw new Error(`Band ${parsed.bandRef} has no defaultLineup`);
        }
        setStatus(
          "Warning: band has no default lineup. Please fill all required roles.",
        );
        setLineup({});
      } else {
        setLineup({ ...data.defaultLineup });
      }
    }

    load().catch((err) => {
      console.error("setup load failed", {
        command: "read_project/get_band_setup_data",
        resolvedPath: id,
        originalError: err,
      });
      setStatus("Failed to load band data. Check application logs.");
    });
  }, [getDefaultBandLeader, id]);

  const errors = useMemo(() => {
    if (!setupData) return [];
    const baseErrors = validateLineup(
      lineup,
      setupData.constraints,
      ROLE_ORDER,
    );
    return baseErrors;
  }, [lineup, setupData]);

  const selectedMusicianIds = useMemo(() => {
    if (!setupData) return [];
    return getUniqueSelectedMusicians(
      lineup,
      setupData.constraints,
      ROLE_ORDER,
    );
  }, [lineup, setupData]);

  const selectedOptions = useMemo(() => {
    if (!setupData) return [] as MemberOption[];
    const all = Object.values(setupData.members).flat();
    const byId = new Map<string, MemberOption>();
    for (const member of all) {
      byId.set(member.id, member);
    }
    return selectedMusicianIds
      .map((idValue) => byId.get(idValue))
      .filter(Boolean) as MemberOption[];
  }, [setupData, selectedMusicianIds]);

  useEffect(() => {
    if (!bandLeaderId) return;
    if (!selectedMusicianIds.includes(bandLeaderId)) {
      setBandLeaderId("");
      setStatus(
        "Band leader was cleared because that musician is no longer in lineup.",
      );
    }
  }, [bandLeaderId, selectedMusicianIds]);

  useEffect(() => {
    if (!talkbackOwnerId) return;
    if (!selectedMusicianIds.includes(talkbackOwnerId)) {
      setTalkbackOwnerId("");
    }
  }, [selectedMusicianIds, talkbackOwnerId]);

  async function saveAndContinue() {
    if (!project || !setupData) return;
    if (errors.length > 0) {
      setStatus("Lineup is incomplete or violates role constraints.");
      return;
    }
    if (!bandLeaderId) {
      setStatus("Band leader is required.");
      return;
    }
    const effectiveTalkbackOwnerId = talkbackOwnerId || bandLeaderId;
    const payload: NewProjectPayload = {
      ...project,
      lineup: { ...lineup },
      bandLeaderId,
      ...(effectiveTalkbackOwnerId !== bandLeaderId
        ? { talkbackOwnerId: effectiveTalkbackOwnerId }
        : {}),
    };
    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(payload, null, 2),
    });
    setStatus("Lineup saved.");
    navigate(`/projects/${id}`);
  }

  function updateSlot(role: string, slotIndex: number, musicianId: string) {
    const constraint = normalizeRoleConstraint(
      role,
      setupData?.constraints[role],
    );
    const current = normalizeLineupValue(lineup[role], constraint.max);
    while (current.length < Math.max(constraint.max, slotIndex + 1)) {
      current.push("");
    }
    current[slotIndex] = musicianId;
    const next = current.filter((entry) => entry);
    setLineup((prev) => {
      const value: LineupValue | undefined =
        constraint.max <= 1 ? next[0] : next;
      return { ...prev, [role]: value };
    });
  }

  function removeSelection(role: string, slotIndex: number) {
    const constraint = normalizeRoleConstraint(
      role,
      setupData?.constraints[role],
    );
    const current = normalizeLineupValue(lineup[role], constraint.max);
    current.splice(slotIndex, 1);
    const next = current.filter(Boolean);
    setLineup((prev) => ({
      ...prev,
      [role]: constraint.max <= 1 ? next[0] : next,
    }));
  }

  function resetToDefault() {
    if (!setupData) return;
    const confirmed = window.confirm(
      "Reset lineup, band leader, and talkback owner to band defaults?",
    );
    if (!confirmed) return;
    setLineup({ ...(setupData.defaultLineup ?? {}) });
    setBandLeaderId(getDefaultBandLeader(setupData));
    setTalkbackOwnerId("");
    setStatus("Setup reset to defaults.");
  }

  const talkbackOptions = selectedOptions.filter(
    (member) => member.id !== bandLeaderId,
  );

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Project Setup</h2>
        <div className="actions-row">
          <button
            type="button"
            className="button-secondary"
            onClick={resetToDefault}
          >
            Reset to default
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => navigate("/")}
          >
            Back to projects
          </button>
        </div>
      </div>

      <p className="subtle">Configure lineup for Input List and Stage Plan.</p>

      {setupData ? (
        ROLE_ORDER.map((role) => {
          const constraint = normalizeRoleConstraint(
            role,
            setupData.constraints[role],
          );
          const selected = normalizeLineupValue(lineup[role], constraint.max);
          const members = setupData.members[role] || [];
          const isMulti = role === "vocs";
          return (
            <article key={role} className="lineup-card">
              <h3>{role.toUpperCase()}</h3>
              {isMulti ? (
                <div className="lineup-list">
                  {(selected.length > 0 ? selected : [""]).map(
                    (musicianId, index) => (
                      <div
                        key={`${role}-${musicianId || index}`}
                        className="lineup-list__row"
                      >
                        <span className="lineup-list__name">
                          {musicianId
                            ? (members.find((m) => m.id === musicianId)?.name ??
                              musicianId)
                            : "No vocalist selected"}
                        </span>
                        <div className="actions-row">
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() =>
                              setEditing({ role, slotIndex: index })
                            }
                          >
                            Change
                          </button>
                          {musicianId ? (
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => removeSelection(role, index)}
                            >
                              Remove
                            </button>
                          ) : null}
                          {(selected.length === 0 ||
                            index === selected.length - 1) &&
                          selected.length < constraint.max ? (
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() =>
                                setEditing({ role, slotIndex: selected.length })
                              }
                            >
                              Add
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="lineup-list__row">
                  <span className="lineup-list__name">
                    {selected[0]
                      ? (members.find((m) => m.id === selected[0])?.name ??
                        selected[0])
                      : "Not selected"}
                  </span>
                  <div className="actions-row">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setEditing({ role, slotIndex: 0 })}
                    >
                      Change
                    </button>
                    {selected[0] ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => removeSelection(role, 0)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </article>
          );
        })
      ) : (
        <p className="subtle">Loading setup…</p>
      )}

      <article className="lineup-card">
        <p className="subtle">
          Select the member responsible for technical communication.
        </p>
        <h3>BAND LEADER</h3>
        <label>
          <select
            value={bandLeaderId}
            onChange={(event) => setBandLeaderId(event.target.value)}
          >
            <option value="">Select lineup member</option>
            {selectedOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      </article>

      <article className="lineup-card">
        <p className="subtle">Assign the talkback microphone owner.</p>
        <h3>TALKBACK</h3>
        <label>
          <select
            value={talkbackOwnerId}
            onChange={(event) => setTalkbackOwnerId(event.target.value)}
          >
            <option value="">Use band leader default</option>
            {talkbackOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      </article>

      {errors.length > 0 ? (
        <div className="status status--error">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      {status ? <p className="status status--error">{status}</p> : null}

      <div className="actions-row">
        <button
          type="button"
          onClick={saveAndContinue}
          disabled={errors.length > 0}
        >
          Continue
        </button>
      </div>

      {editing && setupData ? (
        <dialog className="selector-overlay" open>
          <div className="selector-dialog">
            <div className="panel__header">
              <h3>Select {editing.role}</h3>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEditing(null)}
              >
                Close
              </button>
            </div>
            <div className="selector-list">
              {(setupData.members[editing.role] || []).map((member) => (
                <button
                  type="button"
                  key={member.id}
                  className="selector-option"
                  onClick={() => {
                    updateSlot(editing.role, editing.slotIndex, member.id);
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

export default App;
