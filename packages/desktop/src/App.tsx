import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import desktopPackage from "../package.json";
import {
  type LineupMap,
  type RoleConstraint,
  autoFormatDateInput,
  formatIsoDateToUs,
  getCurrentYearLocal,
  getTodayIsoLocal,
  getUniqueSelectedMusicians,
  isPastIsoDate,
  isValidityYearInPast,
  matchProjectDetailPath,
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  normalizeLineupValue,
  normalizeRoleConstraint,
  parseUsDateInput,
  resolveBandLeaderId,
  resolveTalkbackOwnerId,
  sanitizeVenueSlug,
  validateLineup,
} from "./projectRules";
import "./App.css";

type ProjectSummary = { id: string; bandRef?: string | null; eventDate?: string | null; eventVenue?: string | null; purpose?: string | null; createdAt?: string | null };
type BandOption = { id: string; name: string; code?: string | null };
type MemberOption = { id: string; name: string };
type BandSetupData = { id: string; name: string; bandLeader?: string | null; defaultContactId?: string | null; constraints: Record<string, RoleConstraint>; defaultLineup?: LineupMap | null; members: Record<string, MemberOption[]> };
type NewProjectPayload = { id: string; purpose: "event" | "generic"; bandRef: string; documentDate: string; eventDate?: string; eventVenue?: string; note?: string; createdAt: string; lineup?: LineupMap; bandLeaderId?: string; talkbackOwnerId?: string };
type MapySuggestion = { id: string; cityName: string; label: string };
type MapyKeyStatus = { source: "env" | "config" | "none" };
type ApiError = { message?: string };

const ROLE_ORDER = ["drums", "bass", "guitar", "keys", "vocs"];

function formatDateForProjectId(eventDate: string) { const [year, month, day] = eventDate.split("-"); if (!year || !month || !day) throw new Error(`Invalid event date: ${eventDate}`); return `${day}-${month}-${year}`; }
function buildEventProjectId(band: BandOption, eventDate: string, eventVenue: string) { return `${band.code?.trim() || band.id}_Inputlist_Stageplan_${formatDateForProjectId(eventDate)}_${sanitizeVenueSlug(eventVenue) || "venue"}`; }
function buildGenericProjectId(band: BandOption, year: string) { return `${band.code?.trim() || band.id}_Inputlist_Stageplan_${year}`; }
function formatProjectDate(project: ProjectSummary) { if (project.eventDate) return project.eventDate; if (!project.createdAt) return "—"; return new Date(project.createdAt).toLocaleDateString(); }
function getCurrentPath() { return window.location.pathname || "/"; }
function isDev() { return Boolean(import.meta.env.DEV); }

function App() {
  const [userDataDir, setUserDataDir] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [bands, setBands] = useState<BandOption[]>([]);
  const [status, setStatus] = useState("");
  const [pathname, setPathname] = useState(getCurrentPath());
  const navigate = (path: string) => { window.history.pushState({}, "", path); setPathname(path); };

  const refreshProjects = useCallback(async () => setProjects(await invoke<ProjectSummary[]>("list_projects")), []);
  const refreshBands = useCallback(async () => setBands(await invoke<BandOption[]>("list_bands")), []);
  useEffect(() => { const h = () => setPathname(getCurrentPath()); window.addEventListener("popstate", h); return () => window.removeEventListener("popstate", h); }, []);
  useEffect(() => { (async () => { setUserDataDir(await invoke<string>("get_user_data_dir")); await Promise.all([refreshProjects(), refreshBands()]); })().catch(() => setStatus("Failed to load initial data.")); }, [refreshBands, refreshProjects]);

  const setupProjectId = useMemo(() => matchProjectSetupPath(pathname), [pathname]);
  const previewProjectId = useMemo(() => matchProjectPreviewPath(pathname), [pathname]);
  const projectId = useMemo(() => matchProjectDetailPath(pathname), [pathname]);
  const eventEditProjectId = useMemo(() => matchProjectEventPath(pathname), [pathname]);
  const genericEditProjectId = useMemo(() => matchProjectGenericPath(pathname), [pathname]);

  return <main className="app-shell">
    <header className="app-header"><div className="app-header__brand"><div className="app-header__icon-slot" aria-hidden="true" /><div><h1>StagePilot</h1><p className="subtle">Desktop v{desktopPackage.version}</p></div></div></header>
    {status ? <p className="status status--error">{status}</p> : null}
    {pathname === "/" ? <StartPage projects={projects} userDataDir={userDataDir} navigate={navigate} onOpenExisting={() => setStatus("Open Existing is not implemented yet.")} /> : null}
    {pathname === "/projects/new" ? <ChooseProjectTypePage navigate={navigate} /> : null}
    {pathname === "/projects/new/event" ? <NewEventProjectPage bands={bands} navigate={navigate} onCreated={refreshProjects} /> : null}
    {pathname === "/projects/new/generic" ? <NewGenericProjectPage bands={bands} navigate={navigate} onCreated={refreshProjects} /> : null}
    {eventEditProjectId ? <NewEventProjectPage bands={bands} navigate={navigate} onCreated={refreshProjects} editingProjectId={eventEditProjectId} /> : null}
    {genericEditProjectId ? <NewGenericProjectPage bands={bands} navigate={navigate} onCreated={refreshProjects} editingProjectId={genericEditProjectId} /> : null}
    {setupProjectId ? <ProjectSetupPage id={setupProjectId} navigate={navigate} /> : null}
    {previewProjectId ? <ProjectPreviewPage id={previewProjectId} navigate={navigate} /> : null}
    {projectId && !setupProjectId && !previewProjectId ? <ProjectDetailPage id={projectId} navigate={navigate} /> : null}
  </main>;
}

type StartPageProps = { projects: ProjectSummary[]; userDataDir: string; navigate: (path: string) => void; onOpenExisting: () => void };
function StartPage({ projects, userDataDir, navigate, onOpenExisting }: StartPageProps) {
  return <section className="panel"><div className="panel__header"><h2>Project Hub</h2>{isDev() ? <p className="subtle">{userDataDir ? `Data: ${userDataDir}` : "Loading user_data…"}</p> : null}</div><h3>Projects</h3><div className="actions-row"><button type="button" onClick={() => navigate("/projects/new")}>+ New Project</button><button type="button" className="button-secondary" onClick={onOpenExisting}>Open Existing</button></div>{projects.length === 0 ? <p className="subtle">No projects found.</p> : <div className="project-list">{projects.map((project) => <button type="button" key={project.id} className="project-card" onClick={() => navigate(`/projects/${project.id}`)}><strong>{project.id}</strong><span>Purpose: {project.purpose ?? "—"}</span><span>Date: {formatProjectDate(project)}</span></button>)}</div>}</section>;
}
function ChooseProjectTypePage({ navigate }: { navigate: (path: string) => void }) {
  return <section className="panel panel--choice"><div className="panel__header panel__header--stack"><h2>New Project</h2><button type="button" className="button-secondary" onClick={() => navigate("/")}>Back to projects</button></div><div className="choice-grid" aria-label="Project type options"><button type="button" className="choice-card" onClick={() => navigate("/projects/new/event")}><span className="choice-card__title">Event project</span><span className="choice-card__desc">For a specific show with date and venue.</span></button><button type="button" className="choice-card" onClick={() => navigate("/projects/new/generic")}><span className="choice-card__title">Generic template</span><span className="choice-card__desc">Reusable template for a season or tour.</span></button></div></section>;
}

type NewProjectPageProps = { navigate: (path: string) => void; onCreated: () => Promise<void>; bands: BandOption[]; editingProjectId?: string };
function NewEventProjectPage({ navigate, onCreated, bands, editingProjectId }: NewProjectPageProps) {
  const [eventDateIso, setEventDateIso] = useState("");
  const [eventDateInput, setEventDateInput] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [bandRef, setBandRef] = useState("");
  const [status, setStatus] = useState("");
  const [mapyKeySource, setMapyKeySource] = useState<MapyKeyStatus["source"]>("none");
  const [venueSuggestions, setVenueSuggestions] = useState<MapySuggestion[]>([]);
  const [venueLoading, setVenueLoading] = useState(false);
  const [hasQueriedVenue, setHasQueriedVenue] = useState(false);
  const venueCacheRef = useRef<Map<string, MapySuggestion[]>>(new Map());
  const todayIso = getTodayIsoLocal();
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(eventDateIso && !isPastIsoDate(eventDateIso, todayIso) && eventVenue.trim() && selectedBand);

  useEffect(() => {
    invoke<MapyKeyStatus>("get_mapy_key_status")
      .then((result) => {
        setMapyKeySource(result.source);
        if (isDev()) console.debug("[mapy] key source", result);
      })
      .catch(() => setMapyKeySource("none"));
    if (!editingProjectId) return;
    invoke<string>("read_project", { projectId: editingProjectId })
      .then((raw) => { const project = JSON.parse(raw) as NewProjectPayload; setEventDateIso(project.eventDate ?? ""); setEventDateInput(project.eventDate ? formatIsoDateToUs(project.eventDate) : ""); setEventVenue(project.eventVenue ?? ""); setBandRef(project.bandRef); })
      .catch(() => setStatus("Failed to load existing event setup."));
  }, [editingProjectId]);

  useEffect(() => {
    const query = eventVenue.trim();
    if (mapyKeySource === "none" || query.length < 3) { setVenueSuggestions([]); setVenueLoading(false); setHasQueriedVenue(false); return; }
    const cacheKey = query.toLowerCase();
    const cached = venueCacheRef.current.get(cacheKey);
    if (isDev()) console.debug("[mapy] suggest trigger", { query, length: query.length, cache: cached ? "hit" : "miss" });
    if (cached) { setVenueSuggestions(cached); setHasQueriedVenue(true); return; }
    setVenueLoading(true);
    const timer = setTimeout(async () => {
      try {
        const list = await invoke<MapySuggestion[]>("suggest_cities", { query });
        venueCacheRef.current.set(cacheKey, list);
        setVenueSuggestions(list);
        setHasQueriedVenue(true);
      } catch {
        setVenueSuggestions([]);
        setHasQueriedVenue(true);
      } finally {
        setVenueLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [eventVenue, mapyKeySource]);

  function updateDateInput(value: string) {
    const formatted = autoFormatDateInput(value);
    setEventDateInput(formatted);
    const parsed = parseUsDateInput(formatted);
    setEventDateIso(!parsed || isPastIsoDate(parsed, todayIso) ? "" : parsed);
  }

  async function createProject() {
    if (!selectedBand || !eventDateIso || !eventVenue.trim()) return setStatus("Date, venue, and band are required.");
    const id = editingProjectId ?? buildEventProjectId(selectedBand, eventDateIso, eventVenue);
    const payload: NewProjectPayload = { id, purpose: "event", eventDate: eventDateIso, eventVenue: eventVenue.trim(), bandRef: selectedBand.id, documentDate: todayIso, createdAt: new Date().toISOString() };
    await invoke("save_project", { projectId: id, json: JSON.stringify(payload, null, 2) });
    await onCreated();
    navigate(`/projects/${id}/setup`);
  }

  const showSuggestionBox = mapyKeySource !== "none" && eventVenue.trim().length >= 3;
  return <section className="panel"><div className="panel__header"><h2>{editingProjectId ? "Edit Event setup" : "New Event project"}</h2><button type="button" className="button-secondary" onClick={() => navigate(editingProjectId ? `/projects/${editingProjectId}/setup` : "/projects/new")}>{editingProjectId ? "Cancel" : "Back"}</button></div><div className="form-grid">
    <label>Date *<input type="text" inputMode="numeric" lang="en-GB" placeholder="DD/MM/YYYY" value={eventDateInput} onChange={(e) => updateDateInput(e.target.value)} onClick={() => datePickerRef.current?.showPicker?.()} /><input ref={datePickerRef} className="date-picker-proxy" type="date" lang="en-GB" min={todayIso} value={eventDateIso} onChange={(e) => { setEventDateIso(e.target.value); setEventDateInput(formatIsoDateToUs(e.target.value)); }} aria-hidden="true" tabIndex={-1} /></label>
    <label className="venue-field">Venue *<input type="text" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} placeholder="City" autoComplete="off" />
      {mapyKeySource === "none" ? <span className="field-hint">Autocomplete unavailable (missing MAPY API key).</span> : null}
      {showSuggestionBox ? <div className="combo-list" role="listbox" aria-label="Venue suggestions">
        {venueSuggestions.map((item) => <button key={item.id} type="button" className="combo-item" onClick={() => { setEventVenue(item.cityName); setVenueSuggestions([]); setHasQueriedVenue(false); }}><strong>{item.cityName}</strong> <span>{item.label}</span></button>)}
        {venueLoading ? <div className="combo-empty">Searching…</div> : null}
        {!venueLoading && hasQueriedVenue && venueSuggestions.length === 0 ? <div className="combo-empty">No matches</div> : null}
      </div> : null}
    </label>
    <label>Band *<select value={bandRef} onChange={(e) => setBandRef(e.target.value)}><option value="">Select band</option>{bands.map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}</select></label>
  </div>{status ? <p className="status status--error">{status}</p> : null}<div className="actions-row actions-row--spaced"><button type="button" className="button-secondary" onClick={() => navigate(editingProjectId ? `/projects/${editingProjectId}/setup` : "/projects/new")}>{editingProjectId ? "Cancel" : "Back"}</button><button type="button" onClick={createProject} disabled={!canSubmit}>{editingProjectId ? "Save & Continue" : "Create"}</button></div></section>;
}

function NewGenericProjectPage({ navigate, onCreated, bands, editingProjectId }: NewProjectPageProps) {
  const currentYear = getCurrentYearLocal();
  const [year, setYear] = useState(String(currentYear));
  const [note, setNote] = useState("");
  const [bandRef, setBandRef] = useState("");
  const [status, setStatus] = useState("");
  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(selectedBand && /^\d{4}$/.test(year) && !isValidityYearInPast(year, currentYear));

  useEffect(() => {
    if (!editingProjectId) return;
    invoke<string>("read_project", { projectId: editingProjectId }).then((raw) => {
      const project = JSON.parse(raw) as NewProjectPayload;
      setBandRef(project.bandRef); setNote(project.note ?? ""); setYear(project.documentDate.slice(0, 4));
    }).catch(() => setStatus("Failed to load existing generic setup."));
  }, [editingProjectId]);

  async function createProject() {
    if (!selectedBand) return;
    const id = editingProjectId ?? buildGenericProjectId(selectedBand, year);
    const payload: NewProjectPayload = { id, purpose: "generic", bandRef: selectedBand.id, documentDate: `${year}-01-01`, ...(note.trim() ? { note: note.trim() } : {}), createdAt: new Date().toISOString() };
    await invoke("save_project", { projectId: id, json: JSON.stringify(payload, null, 2) });
    await onCreated();
    navigate(`/projects/${id}/setup`);
  }

  return <section className="panel"><div className="panel__header"><h2>{editingProjectId ? "Edit Generic setup" : "New Generic project"}</h2><button type="button" className="button-secondary" onClick={() => navigate("/projects/new")}>Back</button></div><div className="form-grid"><label>Band *<select value={bandRef} onChange={(e) => setBandRef(e.target.value)}><option value="">Select band</option>{bands.map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}</select></label><label>Note<input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></label><label>Validity year *<input type="number" min={currentYear} max="2100" value={year} onChange={(e) => { setYear(e.target.value); setStatus(""); }} /></label></div>{status ? <p className="status status--error">{status}</p> : null}<div className="actions-row"><button type="button" onClick={createProject} disabled={!canSubmit}>{editingProjectId ? "Save & Continue" : "Create"}</button></div></section>;
}

type ProjectDetailPageProps = { id: string; navigate: (path: string) => void };
function ProjectDetailPage({ id, navigate }: ProjectDetailPageProps) { return <section className="panel"><h2>Project Detail</h2><p>Project ID: {id}</p><div className="actions-row"><button type="button" onClick={() => navigate(`/projects/${id}/setup`)}>Open setup</button><button type="button" className="button-secondary" onClick={() => navigate("/")}>Back to projects</button></div></section>; }

function ProjectSetupPage({ id, navigate }: ProjectDetailPageProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const [lineup, setLineup] = useState<LineupMap>({});
  const [editing, setEditing] = useState<{ role: string; slotIndex: number; currentSelectedId?: string } | null>(null);
  const [bandLeaderId, setBandLeaderId] = useState("");
  const [talkbackOwnerId, setTalkbackOwnerId] = useState("");
  const [status, setStatus] = useState("");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  const applyState = useCallback((nextLineup: LineupMap, data: BandSetupData, storedLeader?: string, storedTalkback?: string) => {
    const selected = getUniqueSelectedMusicians(nextLineup, data.constraints, ROLE_ORDER);
    const resolvedLeader = resolveBandLeaderId({ selectedMusicianIds: selected, storedBandLeaderId: storedLeader, bandLeaderId: data.bandLeader, defaultContactId: data.defaultContactId });
    const resolvedTalkback = resolveTalkbackOwnerId({ selectedMusicianIds: selected, bandLeaderId: resolvedLeader, storedTalkbackOwnerId: storedTalkback });
    setLineup(nextLineup);
    setBandLeaderId(resolvedLeader);
    setTalkbackOwnerId(resolvedTalkback);
  }, []);

  useEffect(() => {
    (async () => {
      const parsed = JSON.parse(await invoke<string>("read_project", { projectId: id })) as NewProjectPayload;
      const data = await invoke<BandSetupData>("get_band_setup_data", { bandId: parsed.bandRef });
      setProject(parsed); setSetupData(data);
      const initialLineup = { ...(parsed.lineup ?? data.defaultLineup ?? {}) };
      applyState(initialLineup, data, parsed.bandLeaderId, parsed.talkbackOwnerId);
    })().catch(() => setStatus("Failed to load setup."));
  }, [id, applyState]);

  const errors = useMemo(() => !setupData ? [] : validateLineup(lineup, setupData.constraints, ROLE_ORDER), [lineup, setupData]);
  const selectedMusicianIds = useMemo(() => !setupData ? [] : getUniqueSelectedMusicians(lineup, setupData.constraints, ROLE_ORDER), [lineup, setupData]);
  const selectedOptions = useMemo(() => { if (!setupData) return [] as MemberOption[]; const byId = new Map<string, MemberOption>(); Object.values(setupData.members).flat().forEach((m) => byId.set(m.id, m)); return selectedMusicianIds.map((idValue) => byId.get(idValue)).filter(Boolean) as MemberOption[]; }, [selectedMusicianIds, setupData]);
  const talkbackCurrentOwnerId = talkbackOwnerId || bandLeaderId;

  async function persistProject(next?: Partial<NewProjectPayload>) {
    if (!project) return;
    const payload: NewProjectPayload = { ...project, lineup: { ...lineup }, bandLeaderId, ...(talkbackCurrentOwnerId && talkbackCurrentOwnerId !== bandLeaderId ? { talkbackOwnerId: talkbackCurrentOwnerId } : {}), ...next };
    await invoke("save_project", { projectId: id, json: JSON.stringify(payload, null, 2) });
    setProject(payload);
  }

  function updateSlot(role: string, slotIndex: number, musicianId: string) {
    if (!setupData) return;
    const constraint = normalizeRoleConstraint(role, setupData.constraints[role]);
    const current = normalizeLineupValue(lineup[role], constraint.max);
    while (current.length < Math.max(constraint.max, slotIndex + 1)) current.push("");
    current[slotIndex] = musicianId;
    const nextLineup = { ...lineup, [role]: constraint.max <= 1 ? current.filter(Boolean)[0] : current.filter(Boolean) };
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  const backSetupPath = project?.purpose === "generic" ? `/projects/${encodeURIComponent(id)}/generic` : `/projects/${encodeURIComponent(id)}/event`;
  const bandName = setupData?.name ?? project?.bandRef ?? "—";
  const summarySecondary = project?.purpose === "event" ? [project.eventDate ? formatIsoDateToUs(project.eventDate) : "", project.eventVenue ?? ""].filter(Boolean).join(" • ") : [project?.documentDate?.slice(0, 4) ?? "", project?.note ?? ""].filter(Boolean).join(" • ");

  return <section className="panel panel--setup">
    <div className="panel__header"><h2>Lineup Setup</h2><button type="button" className="button-secondary" onClick={() => navigate("/")}>Back to projects</button></div>
    <div className="context-header"><strong>{bandName}</strong><span>{summarySecondary || "—"}</span></div>
    <div className="lineup-grid">{setupData ? ROLE_ORDER.map((role) => { const constraint = normalizeRoleConstraint(role, setupData.constraints[role]); const selected = normalizeLineupValue(lineup[role], constraint.max); const members = setupData.members[role] || []; return <article key={role} className="lineup-card"><h3>{role.toUpperCase()}</h3><div className="lineup-list lineup-list--single">{(selected.length ? selected : [""]).map((musicianId, index) => { const alternatives = members.filter((m) => m.id !== musicianId); return <div key={`${role}-${index}`} className="lineup-list__row"><span className="lineup-list__name">{musicianId ? members.find((m) => m.id === musicianId)?.name ?? musicianId : "Not selected"}</span><button type="button" className="button-secondary" disabled={alternatives.length === 0} onClick={() => setEditing({ role, slotIndex: index, currentSelectedId: musicianId || undefined })}>Change</button></div>; })}</div></article>; }) : null}
      <article className="lineup-card"><h3>BAND LEADER</h3><div className="lineup-list__row"><span className="lineup-list__name">{selectedOptions.find((m) => m.id === bandLeaderId)?.name || "Not selected"}</span><button type="button" className="button-secondary" disabled={selectedOptions.filter((m) => m.id !== bandLeaderId).length === 0} onClick={() => setEditing({ role: "leader", slotIndex: 0, currentSelectedId: bandLeaderId })}>Change</button></div></article>
      <article className="lineup-card"><h3>TALKBACK</h3><div className="lineup-list__row"><span className="lineup-list__name">{selectedOptions.find((m) => m.id === talkbackCurrentOwnerId)?.name || "Use band leader default"}</span><button type="button" className="button-secondary" disabled={selectedOptions.filter((m) => m.id !== talkbackCurrentOwnerId).length === 0} onClick={() => setEditing({ role: "talkback", slotIndex: 0, currentSelectedId: talkbackCurrentOwnerId })}>Change</button></div></article>
    </div>
    {errors.length > 0 ? <div className="status status--error">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
    {status ? <p className="status status--error">{status}</p> : null}

    <div className="setup-action-bar"><button type="button" className="button-secondary" onClick={() => navigate(backSetupPath)}>{project?.purpose === "generic" ? "Back to generic setup" : "Back to event setup"}</button><button type="button" className="button-secondary" onClick={() => setShowResetConfirmation(true)}>Reset to defaults</button><button type="button" onClick={async () => { if (errors.length > 0) return; await persistProject(); navigate(`/projects/${id}/preview`); }} disabled={errors.length > 0}>Continue</button></div>

    {showResetConfirmation ? <dialog className="selector-overlay" open onCancel={(event) => { event.preventDefault(); setShowResetConfirmation(false); }}><div className="selector-dialog" role="alertdialog" aria-modal="true"><div className="panel__header panel__header--stack"><h3>Reset to defaults?</h3><p className="subtle">This will reset lineup, band leader, and talkback to the band defaults.</p></div><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setShowResetConfirmation(false)}>Cancel</button><button type="button" onClick={() => { if (!setupData) return; applyState({ ...(setupData.defaultLineup ?? {}) }, setupData); setShowResetConfirmation(false); }}>Reset</button></div></div></dialog> : null}

    {editing && setupData ? <dialog className="selector-overlay" open><div className="selector-dialog"><div className="panel__header"><h3>Select {editing.role.toUpperCase()}</h3><button type="button" className="button-secondary" onClick={() => setEditing(null)}>Close</button></div><div className="selector-list">{(editing.role === "leader" ? selectedOptions.filter((m) => m.id !== editing.currentSelectedId) : editing.role === "talkback" ? selectedOptions.filter((m) => m.id !== talkbackCurrentOwnerId) : (setupData.members[editing.role] || []).filter((m) => m.id !== editing.currentSelectedId)).map((member) => <button type="button" key={member.id} className="selector-option" onClick={() => { if (editing.role === "leader") setBandLeaderId(member.id); else if (editing.role === "talkback") setTalkbackOwnerId(member.id); else updateSlot(editing.role, editing.slotIndex, member.id); setEditing(null); }}>{member.name}</button>)}</div></div></dialog> : null}
  </section>;
}

function ProjectPreviewPage({ id, navigate }: ProjectDetailPageProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [base64Pdf, setBase64Pdf] = useState("");
  const [status, setStatus] = useState("");
  const [zoom, setZoom] = useState(100);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const regeneratePreview = useCallback(async () => {
    setLoadingPreview(true);
    setStatus("");
    try {
      const result = await invoke<{ base64Pdf: string }>("build_project_pdf_preview", { projectId: id });
      setBase64Pdf(result.base64Pdf);
    } catch (err) {
      const message = (err as ApiError)?.message ?? "Failed to generate preview.";
      console.error("Preview generation failed", err);
      setStatus(`Preview failed: ${message}`);
      setBase64Pdf("");
    } finally {
      setLoadingPreview(false);
    }
  }, [id]);

  useEffect(() => { invoke<string>("read_project", { projectId: id }).then((raw) => setProject(JSON.parse(raw) as NewProjectPayload)).catch(() => setStatus("Failed to load project.")); }, [id]);
  useEffect(() => { regeneratePreview(); }, [regeneratePreview]);

  return <section className="panel panel--preview"><div className="panel__header"><h2>PDF Preview</h2></div>
    <div className="pdf-preview-panel">
      {loadingPreview ? <p className="subtle">Generating preview…</p> : null}
      {!loadingPreview && base64Pdf ? <div className="pdf-preview-scroll"><div className="pdf-preview-page-wrapper" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}><object className="pdf-preview-object" data={`data:application/pdf;base64,${base64Pdf}`} type="application/pdf"><p>Unable to render PDF preview.</p></object></div></div> : null}
      {!loadingPreview && !base64Pdf ? <div className="status status--error"><p>{status || "Preview failed."}</p><button type="button" className="button-secondary" onClick={regeneratePreview}>Retry</button></div> : null}
    </div>
    <div className="actions-row"><button type="button" className="button-secondary" onClick={() => setZoom((v) => Math.max(50, v - 10))}>Zoom out</button><button type="button" className="button-secondary" onClick={() => setZoom((v) => Math.min(200, v + 10))}>Zoom in</button></div>
    {status && base64Pdf ? <p className="status status--error">{status}</p> : null}
    <div className="setup-action-bar"><button type="button" className="button-secondary" onClick={() => navigate(`/projects/${id}/setup`)}>Back to lineup setup</button><button type="button" className="button-secondary" onClick={() => setStatus("Project saved.")}>Save project</button><button type="button" disabled={isGeneratingPdf} onClick={async () => {
      if (!project) return;
      try {
        setIsGeneratingPdf(true);
        const exportsDir = await invoke<string>("get_exports_dir");
        const defaultPath = `${exportsDir}${exportsDir.endsWith("\\") || exportsDir.endsWith("/") ? "" : "/"}${project.id}.pdf`;
        const selectedPath = await invoke<string | null>("pick_export_pdf_path", { defaultPath });
        if (!selectedPath) return;
        await invoke("export_pdf_to_path", { projectId: project.id, outputPath: selectedPath });
        setStatus(`Saved: ${selectedPath.split(/[\\/]/).pop()}`);
      } catch (err) {
        console.error("Failed to export PDF", err);
        setStatus(`Export failed: ${(err as ApiError)?.message ?? "unknown error"}`);
      } finally {
        setIsGeneratingPdf(false);
      }
    }}>{isGeneratingPdf ? "Generating…" : "Generate PDF"}</button></div>
  </section>;
}

export default App;
