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

type NewProjectPayload = {
  id: string;
  title: string;
  purpose: "generic";
  bandRef?: string;
  createdAt: string;
};

function slugifyName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
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

  useEffect(() => {
    async function bootstrap() {
      const dir = await invoke<string>("get_user_data_dir");
      setUserDataDir(dir);
      await refreshProjects();
    }

    bootstrap().catch((err) => {
      setStatus(`Failed to load projects: ${String(err)}`);
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
            console.log("open existing clicked");
            setStatus("Open Existing is not implemented yet.");
          }}
        />
      ) : null}

      {pathname === "/projects/new" ? (
        <NewProjectPage
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
        <p className="subtle">{userDataDir ? `Data: ${userDataDir}` : "Loading user_data…"}</p>
      </div>

      <h3>Projects</h3>

      <div className="actions-row">
        <button type="button" onClick={() => navigate("/projects/new")}>+ New Project</button>
        <button type="button" className="button-secondary" onClick={onOpenExisting}>
          Open Existing
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            console.log("debug click");
            navigate("/projects/new");
          }}
        >
          Debug click
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
};

function NewProjectPage({ navigate, onCreated }: NewProjectPageProps) {
  const [projectName, setProjectName] = useState<string>("");
  const [bandRef, setBandRef] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  async function createProject() {
    if (!projectName.trim()) {
      setStatus("Project name is required.");
      return;
    }

    const base = slugifyName(projectName);
    const fallback = `project-${Date.now()}`;
    const id = `${base || fallback}-${Date.now().toString().slice(-6)}`;
    const payload: NewProjectPayload = {
      id,
      title: projectName.trim(),
      purpose: "generic",
      createdAt: new Date().toISOString(),
      ...(bandRef.trim() ? { bandRef: bandRef.trim() } : {}),
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
        <h2>New Project</h2>
        <button type="button" className="button-secondary" onClick={() => navigate("/")}>
          Back to projects
        </button>
      </div>

      <div className="form-grid">
        <label>
          Project name *
          <input
            type="text"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="My next show"
          />
        </label>

        <label>
          bandRef (optional)
          <input
            type="text"
            value={bandRef}
            onChange={(event) => setBandRef(event.target.value)}
            placeholder="placeholder"
          />
        </label>
      </div>

      {status ? <p className="status status--error">{status}</p> : null}

      <div className="actions-row">
        <button type="button" onClick={createProject}>
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
      <button type="button" onClick={() => navigate("/")}>Back to projects</button>
    </section>
  );
}

export default App;
