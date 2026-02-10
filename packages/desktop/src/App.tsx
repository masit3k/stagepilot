import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import desktopPackage from "../package.json";
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

type NewProjectPayload = {
  id: string;
  purpose: "event" | "generic";
  bandRef: string;
  documentDate: string;
  eventDate?: string;
  eventVenue?: string;
  note?: string;
  createdAt: string;
};

function sanitizeVenueSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function buildEventProjectId(band: BandOption, eventDate: string, eventVenue: string): string {
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

function matchProjectDetailPath(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
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

  useEffect(() => {
    const handlePopState = () => setPathname(getCurrentPath());
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  async function refreshProjects() {
    const list = await invoke<ProjectSummary[]>("list_projects");
    setProjects(list);
  }

  async function refreshBands() {
    const list = await invoke<BandOption[]>("list_bands");
    setBands(list);
  }

  useEffect(() => {
    async function bootstrap() {
      const dir = await invoke<string>("get_user_data_dir");
      setUserDataDir(dir);
      await Promise.all([refreshProjects(), refreshBands()]);
    }

    bootstrap().catch((err) => {
      setStatus(`Failed to load app data: ${String(err)}`);
    });
  }, []);

  const projectId = useMemo(() => matchProjectDetailPath(pathname), [pathname]);

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

      {pathname === "/projects/new" ? <ChooseProjectTypePage navigate={navigate} /> : null}

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

      {projectId ? <ProjectDetailPage id={projectId} navigate={navigate} /> : null}
    </main>
  );
}

type StartPageProps = {
  projects: ProjectSummary[];
  userDataDir: string;
  navigate: (path: string) => void;
  onOpenExisting: () => void;
};

function StartPage({ projects, userDataDir, navigate, onOpenExisting }: StartPageProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Project Hub</h2>
        {import.meta.env.DEV ? (
          <p className="subtle">{userDataDir ? `Data: ${userDataDir}` : "Loading user_data…"}</p>
        ) : null}
      </div>

      <h3>Projects</h3>

      <div className="actions-row">
        <button type="button" onClick={() => navigate("/projects/new")}>+ New Project</button>
        <button type="button" className="button-secondary" onClick={onOpenExisting}>
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

function ChooseProjectTypePage({ navigate }: Pick<NewProjectPageProps, "navigate">) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>New Project</h2>
        <button type="button" className="button-secondary" onClick={() => navigate("/")}>
          Back to projects
        </button>
      </div>

      <div className="actions-row">
        <button type="button" onClick={() => navigate("/projects/new/event")}>Event</button>
        <button type="button" onClick={() => navigate("/projects/new/generic")}>Generic</button>
      </div>

      <p className="subtle">For a specific show with date and venue.</p>
      <p className="subtle">Reusable template for a season or tour.</p>
    </section>
  );
}

function NewEventProjectPage({ navigate, onCreated, bands }: NewProjectPageProps) {
  const [eventDate, setEventDate] = useState<string>("");
  const [eventVenue, setEventVenue] = useState<string>("");
  const [bandRef, setBandRef] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(eventDate && eventVenue.trim() && selectedBand);

  async function createProject() {
    if (!selectedBand || !eventDate || !eventVenue.trim()) {
      setStatus("Date, venue, and band are required.");
      return;
    }

    const id = buildEventProjectId(selectedBand, eventDate, eventVenue);
    const payload: NewProjectPayload = {
      id,
      purpose: "event",
      eventDate,
      eventVenue: eventVenue.trim(),
      bandRef: selectedBand.id,
      documentDate: eventDate,
      createdAt: new Date().toISOString(),
    };

    await invoke("save_project", {
      projectId: id,
      json: JSON.stringify(payload, null, 2),
    });

    await onCreated();
    navigate(`/projects/${id}`);
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>New Event Project</h2>
        <button type="button" className="button-secondary" onClick={() => navigate("/projects/new")}>
          Back
        </button>
      </div>

      <div className="form-grid">
        <label>
          Date *
          <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
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
          <select value={bandRef} onChange={(event) => setBandRef(event.target.value)}>
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
        <button type="button" onClick={createProject} disabled={!canSubmit}>Create</button>
      </div>
    </section>
  );
}

function NewGenericProjectPage({ navigate, onCreated, bands }: NewProjectPageProps) {
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
    navigate(`/projects/${id}`);
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>New Generic Project</h2>
        <button type="button" className="button-secondary" onClick={() => navigate("/projects/new")}>
          Back
        </button>
      </div>

      <div className="form-grid">
        <label>
          Band *
          <select value={bandRef} onChange={(event) => setBandRef(event.target.value)}>
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
            placeholder="Reusable template note"
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
        <button type="button" onClick={createProject} disabled={!canSubmit}>Create</button>
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
      <button type="button" onClick={() => navigate("/")}>Back to projects</button>
    </section>
  );
}

export default App;
