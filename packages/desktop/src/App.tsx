import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type ProjectSummary = {
  id: string;
  bandRef?: string | null;
  eventDate?: string | null;
  eventVenue?: string | null;
  purpose?: string | null;
};

type ExportResult = {
  versionPdfPath: string;
  exportPdfPath: string;
  exportUpdated: boolean;
  versionId: string;
  versionPath: string;
};

type ExportError = {
  code?: string;
  message?: string;
  exportPdfPath?: string;
  versionPdfPath?: string;
};

type ProjectForm = {
  id: string;
  purpose?: "event" | "generic";
  bandRef?: string;
  eventDate?: string;
  eventVenue?: string;
  documentDate?: string;
  title?: string;
};

function App() {
  const [userDataDir, setUserDataDir] = useState<string>("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectJson, setProjectJson] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<ProjectForm | null>(null);
  const [status, setStatus] = useState<string>("");
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<ExportError | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId]
  );

  useEffect(() => {
    async function bootstrap() {
      const dir = await invoke<string>("get_user_data_dir");
      setUserDataDir(dir);
      const list = await invoke<ProjectSummary[]>("list_projects");
      setProjects(list);
    }
    bootstrap().catch((err) => {
      setStatus(`Failed to load projects: ${String(err)}`);
    });
  }, []);

  async function openProject(projectId: string) {
    setStatus("");
    setExportResult(null);
    setExportError(null);
    const jsonText = await invoke<string>("read_project", { projectId });
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    setProjectJson(parsed);
    setForm({
      id: String(parsed.id ?? projectId),
      purpose: (parsed.purpose as "event" | "generic" | undefined) ?? undefined,
      bandRef: (parsed.bandRef as string | undefined) ?? "",
      eventDate: (parsed.eventDate as string | undefined) ?? "",
      eventVenue: (parsed.eventVenue as string | undefined) ?? "",
      documentDate: (parsed.documentDate as string | undefined) ?? "",
      title: (parsed.title as string | undefined) ?? "",
    });
    setSelectedId(projectId);
  }

  function updateForm<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveProject() {
    if (!form || !projectJson) return;
    setStatus("");
    const nextJson = {
      ...projectJson,
      id: form.id,
      purpose: form.purpose,
      bandRef: form.bandRef,
      eventDate: form.eventDate || undefined,
      eventVenue: form.eventVenue || undefined,
      documentDate: form.documentDate || undefined,
      title: form.title || undefined,
    };
    await invoke("save_project", { projectId: form.id, json: JSON.stringify(nextJson, null, 2) });
    setProjectJson(nextJson);
    const list = await invoke<ProjectSummary[]>("list_projects");
    setProjects(list);
    setStatus("Project saved.");
  }

  async function exportPdf() {
    if (!form) return;
    setStatus("Exporting PDF…");
    setExportResult(null);
    setExportError(null);
    try {
      const result = await invoke<ExportResult>("export_pdf", { projectId: form.id });
      setExportResult(result);
      setStatus(result.exportUpdated ? "Export updated." : "Version created.");
    } catch (err) {
      const error = err as ExportError;
      if (error?.code === "EXPORT_LOCKED") {
        setStatus(
          "Zavři exportovaný PDF soubor a spusť export znovu. Verze je uložená ve 'versions'."
        );
      } else {
        setStatus(error?.message ?? "Export failed.");
      }
      setExportError(error);
    }
  }

  async function openFile(path: string | undefined) {
    if (!path) return;
    await invoke("open_file", { path });
  }

  async function revealInExplorer(path: string | undefined) {
    if (!path) return;
    await invoke("reveal_in_explorer", { path });
  }

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1>StagePilot Desktop</h1>
          <p className="app__subtle">User data: {userDataDir || "loading…"}</p>
        </div>
      </header>

      <section className="panel">
        <h2>Projects</h2>
        <div className="project-list">
          {projects.length === 0 ? (
            <p className="app__subtle">No projects found in user_data/projects.</p>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-card__meta">
                  <strong>{project.id}</strong>
                  <span>{project.bandRef || "—"}</span>
                  <span>
                    {project.eventDate || "—"} · {project.eventVenue || "—"}
                  </span>
                </div>
                <button type="button" onClick={() => openProject(project.id)}>
                  Open
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {form && (
        <section className="panel">
          <div className="panel__header">
            <h2>Project Editor</h2>
            <span className="app__subtle">Editing: {selectedProject?.id ?? form.id}</span>
          </div>
          <div className="form-grid">
            <label>
              Purpose
              <select
                value={form.purpose ?? ""}
                onChange={(event) =>
                  updateForm("purpose", event.target.value as "event" | "generic" | undefined)
                }
              >
                <option value="">Select</option>
                <option value="event">Event</option>
                <option value="generic">Generic</option>
              </select>
            </label>
            <label>
              Band ref
              <input
                value={form.bandRef ?? ""}
                onChange={(event) => updateForm("bandRef", event.target.value)}
                placeholder="Band reference"
              />
            </label>
            <label>
              Event date
              <input
                type="date"
                value={form.eventDate ?? ""}
                onChange={(event) => updateForm("eventDate", event.target.value)}
              />
            </label>
            <label>
              Event venue
              <input
                value={form.eventVenue ?? ""}
                onChange={(event) => updateForm("eventVenue", event.target.value)}
                placeholder="Venue name"
              />
            </label>
            <label>
              Document date
              <input
                type="date"
                value={form.documentDate ?? ""}
                onChange={(event) => updateForm("documentDate", event.target.value)}
              />
            </label>
            <label>
              Title (optional)
              <input
                value={form.title ?? ""}
                onChange={(event) => updateForm("title", event.target.value)}
                placeholder="Project title"
              />
            </label>
          </div>
          <div className="button-row">
            <button type="button" onClick={saveProject}>
              Save
            </button>
          </div>
        </section>
      )}

      {form && (
        <section className="panel">
          <h2>Export PDF</h2>
          <div className="button-row">
            <button type="button" onClick={exportPdf}>
              Export PDF
            </button>
            <button
              type="button"
              onClick={() =>
                openFile(exportResult?.exportPdfPath ?? exportError?.exportPdfPath)
              }
              disabled={!exportResult?.exportPdfPath && !exportError?.exportPdfPath}
            >
              Open exported PDF
            </button>
            <button
              type="button"
              onClick={() =>
                openFile(exportResult?.versionPdfPath ?? exportError?.versionPdfPath)
              }
              disabled={!exportResult?.versionPdfPath && !exportError?.versionPdfPath}
            >
              Open version PDF
            </button>
            <button
              type="button"
              onClick={() =>
                revealInExplorer(exportResult?.exportPdfPath ?? exportError?.exportPdfPath)
              }
              disabled={!exportResult?.exportPdfPath && !exportError?.exportPdfPath}
            >
              Open exports folder
            </button>
          </div>
          {exportResult && (
            <div className="export-details">
              <p>
                <strong>Version:</strong> {exportResult.versionPdfPath}
              </p>
              <p>
                <strong>Export:</strong> {exportResult.exportPdfPath}
              </p>
              <p>
                <strong>Updated:</strong> {exportResult.exportUpdated ? "Yes" : "No"}
              </p>
            </div>
          )}
          {exportError && (
            <div className="export-details export-details--error">
              <p>
                <strong>Error:</strong> {exportError.message ?? "Export failed"}
              </p>
              {exportError.versionPdfPath && (
                <p>
                  <strong>Version:</strong> {exportError.versionPdfPath}
                </p>
              )}
              {exportError.exportPdfPath && (
                <p>
                  <strong>Export:</strong> {exportError.exportPdfPath}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {status && <div className="status">{status}</div>}
    </main>
  );
}

export default App;
