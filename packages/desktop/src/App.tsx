import { convertFileSrc, invoke } from "@tauri-apps/api/core";
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
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  normalizeCity,
  normalizeLineupValue,
  normalizeRoleConstraint,
  parseUsDateInput,
  buildExportFileName,
  resolveBandLeaderId,
  resolveTalkbackOwnerId,
  validateLineup,
} from "./projectRules";
import "./App.css";

type ProjectSummary = { id: string; displayName?: string | null; bandRef?: string | null; eventDate?: string | null; eventVenue?: string | null; purpose?: string | null; createdAt?: string | null };
type BandOption = { id: string; name: string; code?: string | null };
type MemberOption = { id: string; name: string };
type BandSetupData = { id: string; name: string; bandLeader?: string | null; defaultContactId?: string | null; constraints: Record<string, RoleConstraint>; defaultLineup?: LineupMap | null; members: Record<string, MemberOption[]> };
type NewProjectPayload = { id: string; displayName?: string; purpose: "event" | "generic"; bandRef: string; documentDate: string; eventDate?: string; eventVenue?: string; note?: string; createdAt: string; lineup?: LineupMap; bandLeaderId?: string; talkbackOwnerId?: string };
type ApiError = { message?: string };

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
  if (!year || !month || !day) throw new Error(`Invalid event date: ${eventDate}`);
  return `${day}-${month}-${year}`;
}

function buildEventDisplayName(band: BandOption, eventDate: string, eventVenue: string) {
  return `${band.code?.trim() || band.id}_Inputlist_Stageplan_${formatDateForProjectId(eventDate)}_${normalizeCity(eventVenue) || "Venue"}`;
}

function buildGenericProjectId(band: BandOption, year: string) {
  return `${band.code?.trim() || band.id}_Inputlist_Stageplan_${year}`;
}

function formatProjectDate(project: ProjectSummary) {
  if (project.eventDate) return project.eventDate;
  if (!project.createdAt) return "—";
  return new Date(project.createdAt).toLocaleDateString();
}

function getCurrentPath() {
  return window.location.pathname || "/";
}

function isDev() {
  return Boolean(import.meta.env.DEV);
}

function App() {
  const [userDataDir, setUserDataDir] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [bands, setBands] = useState<BandOption[]>([]);
  const [status, setStatus] = useState("");
  const [pathname, setPathname] = useState(getCurrentPath());
  const pathnameRef = useRef(pathname);
  const guardRef = useRef<NavigationGuard | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const registerNavigationGuard = useCallback((guard: NavigationGuard | null) => {
    guardRef.current = guard;
  }, []);

  const navigateImmediate = useCallback((path: string, replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setPathname(path);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path === pathnameRef.current) return;
    const guard = guardRef.current;
    if (guard?.isDirty()) {
      setPendingNavigation(path);
      return;
    }
    navigateImmediate(path);
  }, [navigateImmediate]);

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
      setUserDataDir(await invoke<string>("get_user_data_dir"));
      await Promise.all([refreshProjects(), refreshBands()]);
    })().catch(() => setStatus("Failed to load initial data."));
  }, [refreshBands, refreshProjects]);

  const setupProjectId = useMemo(() => matchProjectSetupPath(pathname), [pathname]);
  const previewProjectId = useMemo(() => matchProjectPreviewPath(pathname), [pathname]);
  const eventEditProjectId = useMemo(() => matchProjectEventPath(pathname), [pathname]);
  const genericEditProjectId = useMemo(() => matchProjectGenericPath(pathname), [pathname]);

  return <main className="app-shell">
    <header className="app-header"><div className="app-header__brand"><div className="app-header__icon-slot" aria-hidden="true" /><div><h1>StagePilot</h1><p className="subtle">Desktop v{desktopPackage.version}</p></div></div></header>
    {status ? <p className="status status--error">{status}</p> : null}
    {pathname === "/" ? <StartPage projects={projects} userDataDir={userDataDir} navigate={navigate} /> : null}
    {pathname === "/projects/new" ? <ChooseProjectTypePage navigate={navigate} /> : null}
    {pathname === "/projects/new/event" ? <NewEventProjectPage bands={bands} navigate={navigate} onCreated={refreshProjects} registerNavigationGuard={registerNavigationGuard} /> : null}
    {pathname === "/projects/new/generic" ? <NewGenericProjectPage bands={bands} navigate={navigate} onCreated={refreshProjects} registerNavigationGuard={registerNavigationGuard} /> : null}
    {eventEditProjectId ? <NewEventProjectPage bands={bands} navigate={navigate} onCreated={refreshProjects} editingProjectId={eventEditProjectId} registerNavigationGuard={registerNavigationGuard} /> : null}
    {genericEditProjectId ? <NewGenericProjectPage bands={bands} navigate={navigate} onCreated={refreshProjects} editingProjectId={genericEditProjectId} registerNavigationGuard={registerNavigationGuard} /> : null}
    {setupProjectId ? <ProjectSetupPage id={setupProjectId} navigate={navigate} registerNavigationGuard={registerNavigationGuard} /> : null}
    {previewProjectId ? <ProjectPreviewPage id={previewProjectId} navigate={navigate} registerNavigationGuard={registerNavigationGuard} /> : null}
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
  </main>;
}

type StartPageProps = { projects: ProjectSummary[]; userDataDir: string; navigate: (path: string) => void };
function StartPage({ projects, userDataDir, navigate }: StartPageProps) {
  return <section className="panel"><div className="panel__header"><h2>Project Hub</h2>{isDev() ? <p className="subtle">{userDataDir ? `Data: ${userDataDir}` : "Loading user_data…"}</p> : null}</div><div className="actions-row"><button type="button" onClick={() => navigate("/projects/new")}>+ New Project</button></div>{projects.length === 0 ? <p className="subtle">No projects found.</p> : <div className="project-list">{projects.map((project) => <button type="button" key={project.id} className="project-card" onClick={() => navigate(project.purpose === "event" ? `/projects/${project.id}/event` : `/projects/${project.id}/generic`)}><strong>{project.displayName || project.id}</strong><span>Purpose: {project.purpose ?? "—"}</span><span>Date: {formatProjectDate(project)}</span></button>)}</div>}</section>;
}

function ChooseProjectTypePage({ navigate }: { navigate: (path: string) => void }) {
  return <section className="panel panel--choice"><div className="panel__header"><h2>New project</h2><button type="button" className="button-secondary" onClick={() => navigate("/")}>Cancel</button></div><div className="choice-grid" aria-label="Project type options"><button type="button" className="choice-card" onClick={() => navigate("/projects/new/event")}><span className="choice-card__title">Event project</span><span className="choice-card__desc">For a specific show with date and venue.</span></button><button type="button" className="choice-card" onClick={() => navigate("/projects/new/generic")}><span className="choice-card__title">Generic template</span><span className="choice-card__desc">Reusable template for a season or tour.</span></button></div></section>;
}

type NewProjectPageProps = { navigate: (path: string) => void; onCreated: () => Promise<void>; bands: BandOption[]; editingProjectId?: string; registerNavigationGuard: (guard: NavigationGuard | null) => void };
function NewEventProjectPage({ navigate, onCreated, bands, editingProjectId, registerNavigationGuard }: NewProjectPageProps) {
  const [existingProject, setExistingProject] = useState<NewProjectPayload | null>(null);
  const [eventDateIso, setEventDateIso] = useState("");
  const [eventDateInput, setEventDateInput] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [bandRef, setBandRef] = useState("");
  const [status, setStatus] = useState("");
  const todayIso = getTodayIsoLocal();
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(eventDateIso && !isPastIsoDate(eventDateIso, todayIso) && eventVenue.trim() && selectedBand);

  useEffect(() => {
    if (!editingProjectId) return;
    invoke<string>("read_project", { projectId: editingProjectId }).then((raw) => {
      const project = JSON.parse(raw) as NewProjectPayload;
      setExistingProject(project);
      setEventDateIso(project.eventDate ?? "");
      setEventDateInput(project.eventDate ? formatIsoDateToUs(project.eventDate) : "");
      setEventVenue(project.eventVenue ?? "");
      setBandRef(project.bandRef);
    }).catch(() => setStatus("Failed to load existing event setup."));
  }, [editingProjectId]);

  function updateDateInput(value: string) {
    const formatted = autoFormatDateInput(value);
    setEventDateInput(formatted);
    const parsed = parseUsDateInput(formatted);
    setEventDateIso(!parsed || isPastIsoDate(parsed, todayIso) ? "" : parsed);
  }

  const isDirty = Boolean(eventDateInput || eventVenue.trim() || bandRef);

  const persist = useCallback(async () => {
    if (!selectedBand || !eventDateIso || !eventVenue.trim()) return;
    const displayName = buildEventDisplayName(selectedBand, eventDateIso, eventVenue);
    const id = editingProjectId ?? displayName;
    const payload: NewProjectPayload = {
      id,
      displayName,
      purpose: "event",
      eventDate: eventDateIso,
      eventVenue: eventVenue.trim(),
      bandRef: selectedBand.id,
      documentDate: todayIso,
      createdAt: existingProject?.createdAt ?? new Date().toISOString(),
      lineup: existingProject?.lineup,
      bandLeaderId: existingProject?.bandLeaderId,
      talkbackOwnerId: existingProject?.talkbackOwnerId,
      note: existingProject?.note,
    };
    await invoke("save_project", { projectId: id, json: JSON.stringify(payload, null, 2) });
    await onCreated();
  }, [selectedBand, eventDateIso, eventVenue, editingProjectId, todayIso, existingProject, onCreated]);

  useEffect(() => {
    registerNavigationGuard({ isDirty: () => isDirty, save: persist });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, persist]);

  async function createProject() {
    if (!selectedBand || !eventDateIso || !eventVenue.trim()) return setStatus("Date, venue, and band are required.");
    const id = editingProjectId ?? buildEventDisplayName(selectedBand, eventDateIso, eventVenue);
    await persist();
    navigate(`/projects/${id}/setup`);
  }

  return <section className="panel"><div className="panel__header"><h2>{editingProjectId ? "Edit Event setup" : "New Event project"}</h2><button type="button" className="button-secondary" onClick={() => navigate("/")}>Cancel</button></div><div className="form-grid">
    <label>Date *<input type="text" inputMode="numeric" lang="en-GB" placeholder="DD/MM/YYYY" value={eventDateInput} onChange={(e) => updateDateInput(e.target.value)} onClick={() => datePickerRef.current?.showPicker?.()} /><input ref={datePickerRef} className="date-picker-proxy" type="date" lang="en-GB" min={todayIso} value={eventDateIso} onChange={(e) => { setEventDateIso(e.target.value); setEventDateInput(formatIsoDateToUs(e.target.value)); }} aria-hidden="true" tabIndex={-1} /></label>
    <label>Venue *<input type="text" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} placeholder="City" /></label>
    <label>Band *<select value={bandRef} onChange={(e) => setBandRef(e.target.value)}><option value="">Select band</option>{bands.map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}</select></label>
  </div>{status ? <p className="status status--error">{status}</p> : null}<div className="setup-action-bar setup-action-bar--equal"><button type="button" onClick={createProject} disabled={!canSubmit}>Create</button><button type="button" className="button-secondary" onClick={() => navigate("/projects/new")}>Back</button><button type="button" className="button-secondary" onClick={() => navigate("/")}>Cancel</button></div></section>;
}

function NewGenericProjectPage({ navigate, onCreated, bands, editingProjectId, registerNavigationGuard }: NewProjectPageProps) {
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
      setBandRef(project.bandRef);
      setNote(project.note ?? "");
      setYear(project.documentDate.slice(0, 4));
    }).catch(() => setStatus("Failed to load existing generic setup."));
  }, [editingProjectId]);

  const isDirty = Boolean(bandRef || note.trim() || year !== String(currentYear));

  const persist = useCallback(async () => {
    if (!selectedBand) return;
    const id = editingProjectId ?? buildGenericProjectId(selectedBand, year);
    const payload: NewProjectPayload = { id, displayName: buildGenericProjectId(selectedBand, year), purpose: "generic", bandRef: selectedBand.id, documentDate: `${year}-01-01`, ...(note.trim() ? { note: note.trim() } : {}), createdAt: new Date().toISOString() };
    await invoke("save_project", { projectId: id, json: JSON.stringify(payload, null, 2) });
    await onCreated();
  }, [editingProjectId, note, onCreated, selectedBand, year]);

  useEffect(() => {
    registerNavigationGuard({ isDirty: () => isDirty, save: persist });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, persist]);

  async function createProject() {
    if (!selectedBand) return;
    const id = editingProjectId ?? buildGenericProjectId(selectedBand, year);
    await persist();
    navigate(`/projects/${id}/setup`);
  }

  return <section className="panel"><div className="panel__header"><h2>{editingProjectId ? "Edit Generic setup" : "New Generic project"}</h2><button type="button" className="button-secondary" onClick={() => navigate("/")}>Cancel</button></div><div className="form-grid"><label>Band *<select value={bandRef} onChange={(e) => setBandRef(e.target.value)}><option value="">Select band</option>{bands.map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}</select></label><label>Note<input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></label><label>Validity year *<input type="number" min={currentYear} max="2100" value={year} onChange={(e) => { setYear(e.target.value); setStatus(""); }} /></label></div>{status ? <p className="status status--error">{status}</p> : null}<div className="setup-action-bar setup-action-bar--equal"><button type="button" onClick={createProject} disabled={!canSubmit}>{editingProjectId ? "Save & Continue" : "Create"}</button><button type="button" className="button-secondary" onClick={() => navigate("/projects/new")}>Back</button><button type="button" className="button-secondary" onClick={() => navigate("/")}>Cancel</button></div></section>;
}

type ProjectRouteProps = { id: string; navigate: (path: string) => void; registerNavigationGuard: (guard: NavigationGuard | null) => void };
function ProjectSetupPage({ id, navigate, registerNavigationGuard }: ProjectRouteProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const [lineup, setLineup] = useState<LineupMap>({});
  const [editing, setEditing] = useState<{ role: string; slotIndex: number; currentSelectedId?: string } | null>(null);
  const [bandLeaderId, setBandLeaderId] = useState("");
  const [talkbackOwnerId, setTalkbackOwnerId] = useState("");
  const [status, setStatus] = useState("");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const initialSnapshotRef = useRef("");

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
      setProject(parsed);
      setSetupData(data);
      const initialLineup = { ...(parsed.lineup ?? data.defaultLineup ?? {}) };
      applyState(initialLineup, data, parsed.bandLeaderId, parsed.talkbackOwnerId);
      initialSnapshotRef.current = JSON.stringify({ lineup: initialLineup, bandLeaderId: parsed.bandLeaderId ?? "", talkbackOwnerId: parsed.talkbackOwnerId ?? parsed.bandLeaderId ?? "" });
    })().catch(() => setStatus("Failed to load setup."));
  }, [id, applyState]);

  const errors = useMemo(() => !setupData ? [] : validateLineup(lineup, setupData.constraints, ROLE_ORDER), [lineup, setupData]);
  const selectedMusicianIds = useMemo(() => !setupData ? [] : getUniqueSelectedMusicians(lineup, setupData.constraints, ROLE_ORDER), [lineup, setupData]);
  const selectedOptions = useMemo(() => {
    if (!setupData) return [] as MemberOption[];
    const byId = new Map<string, MemberOption>();
    Object.values(setupData.members).flat().forEach((m) => byId.set(m.id, m));
    return selectedMusicianIds.map((idValue) => byId.get(idValue)).filter(Boolean) as MemberOption[];
  }, [selectedMusicianIds, setupData]);
  const talkbackCurrentOwnerId = talkbackOwnerId || bandLeaderId;

  const currentSnapshot = JSON.stringify({ lineup, bandLeaderId, talkbackOwnerId: talkbackCurrentOwnerId });
  const isDirty = Boolean(project && currentSnapshot !== initialSnapshotRef.current);

  async function persistProject(next?: Partial<NewProjectPayload>) {
    if (!project) return;
    const payload: NewProjectPayload = { ...project, lineup: { ...lineup }, bandLeaderId, ...(talkbackCurrentOwnerId && talkbackCurrentOwnerId !== bandLeaderId ? { talkbackOwnerId: talkbackCurrentOwnerId } : {}), ...next };
    await invoke("save_project", { projectId: id, json: JSON.stringify(payload, null, 2) });
    setProject(payload);
    initialSnapshotRef.current = JSON.stringify({ lineup: payload.lineup ?? {}, bandLeaderId: payload.bandLeaderId ?? "", talkbackOwnerId: payload.talkbackOwnerId ?? payload.bandLeaderId ?? "" });
  }

  useEffect(() => {
    registerNavigationGuard({ isDirty: () => isDirty, save: persistProject });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty]);

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
    <div className="panel__header"><h1>Lineup Setup</h1><button type="button" className="button-secondary" onClick={() => navigate("/")}>Cancel</button></div>
    <div className="lineup-meta"><div className="band-name">{bandName}</div><div className="band-meta">{summarySecondary || "—"}</div></div>
    <p className="subtle">Configure lineup for Input List and Stage Plan.<br />Defaults are prefilled from the band’s saved lineup settings.</p>
    <div className="lineup-grid">{setupData ? ROLE_ORDER.map((role) => {
      const constraint = normalizeRoleConstraint(role, setupData.constraints[role]);
      const selected = normalizeLineupValue(lineup[role], constraint.max);
      const members = setupData.members[role] || [];
      return <article key={role} className="lineup-card"><h3>{role.toUpperCase()}</h3><div className="lineup-list lineup-list--single">{(selected.length ? selected : [""]).map((musicianId, index) => {
        const alternatives = members.filter((m) => m.id !== musicianId);
        return <div key={`${role}-${index}`} className="lineup-list__row"><span className="lineup-list__name">{musicianId ? members.find((m) => m.id === musicianId)?.name ?? musicianId : "Not selected"}</span><button type="button" className="button-secondary" disabled={alternatives.length === 0} onClick={() => setEditing({ role, slotIndex: index, currentSelectedId: musicianId || undefined })}>Change</button></div>;
      })}</div></article>;
    }) : null}
      <p className="subtle">Select the on-site band lead for coordination and decisions.</p>
      <article className="lineup-card"><h3>BAND LEADER</h3><div className="lineup-list__row"><span className="lineup-list__name">{selectedOptions.find((m) => m.id === bandLeaderId)?.name || "Not selected"}</span><button type="button" className="button-secondary" disabled={selectedOptions.filter((m) => m.id !== bandLeaderId).length === 0} onClick={() => setEditing({ role: "leader", slotIndex: 0, currentSelectedId: bandLeaderId })}>Change</button></div></article>
      <p className="subtle">Assign talkback microphone owner.</p>
      <article className="lineup-card"><h3>TALKBACK</h3><div className="lineup-list__row"><span className="lineup-list__name">{selectedOptions.find((m) => m.id === talkbackCurrentOwnerId)?.name || "Use band leader default"}</span><button type="button" className="button-secondary" disabled={selectedOptions.filter((m) => m.id !== talkbackCurrentOwnerId).length === 0} onClick={() => setEditing({ role: "talkback", slotIndex: 0, currentSelectedId: talkbackCurrentOwnerId })}>Change</button></div></article>
    </div>
    {errors.length > 0 ? <div className="status status--error">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
    {status ? <p className="status status--error">{status}</p> : null}

    <div className="setup-action-bar"><button type="button" className="button-secondary" onClick={() => navigate(backSetupPath)}>Back</button><button type="button" className="button-secondary" onClick={() => setShowResetConfirmation(true)}>Reset to defaults</button><button type="button" onClick={async () => { if (errors.length > 0) return; await persistProject(); navigate(`/projects/${id}/preview`); }} disabled={errors.length > 0}>Save & Continue</button></div>

    {showResetConfirmation ? <dialog className="selector-overlay" open onCancel={(event) => { event.preventDefault(); setShowResetConfirmation(false); }}><div className="selector-dialog" role="alertdialog" aria-modal="true"><button type="button" className="modal-close" onClick={() => setShowResetConfirmation(false)} aria-label="Close">×</button><div className="panel__header panel__header--stack"><h3>Reset to defaults?</h3><p className="subtle">This will reset lineup, band leader, and talkback to the band defaults.</p></div><div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setShowResetConfirmation(false)}>Cancel</button><button type="button" onClick={() => { if (!setupData) return; applyState({ ...(setupData.defaultLineup ?? {}) }, setupData); setShowResetConfirmation(false); }}>Reset</button></div></div></dialog> : null}

    {editing && setupData ? <dialog className="selector-overlay" open onCancel={(event) => { event.preventDefault(); setEditing(null); }}><div className="selector-dialog"><button type="button" className="modal-close" onClick={() => setEditing(null)} aria-label="Close">×</button><div className="panel__header"><h3>Select {editing.role.toUpperCase()}</h3></div><div className="selector-list">{(editing.role === "leader" ? selectedOptions.filter((m) => m.id !== editing.currentSelectedId) : editing.role === "talkback" ? selectedOptions.filter((m) => m.id !== talkbackCurrentOwnerId) : (setupData.members[editing.role] || []).filter((m) => m.id !== editing.currentSelectedId)).map((member) => <button type="button" key={member.id} className="selector-option" onClick={() => { if (editing.role === "leader") setBandLeaderId(member.id); else if (editing.role === "talkback") setTalkbackOwnerId(member.id); else updateSlot(editing.role, editing.slotIndex, member.id); setEditing(null); }}>{member.name}</button>)}</div></div></dialog> : null}
  </section>;
}

function ExportResultModal({ state, onClose, onRetry }: { state: ExportModalState; onClose: () => void; onRetry: () => void }) {
  if (!state) return null;
  const isSuccess = state.kind === "success";
  return <dialog className="selector-overlay" open onCancel={(event) => { event.preventDefault(); onClose(); }}><div className="selector-dialog" role="dialog" aria-modal="true"><button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button><h3>{isSuccess ? "Export complete" : "Export failed"}</h3>{isSuccess ? <p>PDF was saved successfully.</p> : <><p>Something went wrong during export. Please try again.</p><p className="subtle">{state.message}{state.technical ? ` — ${state.technical}` : ""}</p></>}<div className="modal-actions">{isSuccess ? <><button type="button" className="button-secondary" onClick={() => invoke("open_file", { path: state.path })}>Open file</button><button type="button" className="button-secondary" onClick={() => invoke("reveal_in_explorer", { path: state.path })}>Open folder</button><button type="button" onClick={onClose}>Close</button></> : <><button type="button" className="button-secondary" onClick={onRetry}>Retry</button><button type="button" onClick={onClose}>Close</button></>}</div></div></dialog>;
}

function UnsavedChangesModal({ open, onSaveAndExit, onExitWithoutSaving, onStay }: { open: boolean; onSaveAndExit: () => void | Promise<void>; onExitWithoutSaving: () => void; onStay: () => void }) {
  if (!open) return null;
  return <dialog className="selector-overlay" open onCancel={(event) => { event.preventDefault(); onStay(); }}><div className="selector-dialog" role="alertdialog" aria-modal="true"><button type="button" className="modal-close" onClick={onStay} aria-label="Close">×</button><h3>Unsaved changes</h3><p>You have unsaved changes. What would you like to do?</p><div className="modal-actions"><button type="button" className="button-secondary" onClick={onSaveAndExit}>Save & exit</button><button type="button" className="button-secondary" onClick={onExitWithoutSaving}>Exit without saving</button><button type="button" onClick={onStay}>Stay</button></div></div></dialog>;
}

function ProjectPreviewPage({ id, navigate, registerNavigationGuard }: ProjectRouteProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [previewPath, setPreviewPath] = useState("");
  const [status, setStatus] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exportModal, setExportModal] = useState<ExportModalState>(null);

  const regeneratePreview = useCallback(async () => {
    setLoadingPreview(true);
    setStatus("");
    try {
      const result = await invoke<{ previewPdfPath: string }>("build_project_pdf_preview", { projectId: id });
      setPreviewPath(convertFileSrc(result.previewPdfPath));
    } catch (err) {
      const message = (err as ApiError)?.message ?? "Failed to generate preview.";
      setStatus(`Preview failed: ${message}`);
      setPreviewPath("");
    } finally {
      setLoadingPreview(false);
    }
  }, [id]);

  useEffect(() => {
    invoke<string>("read_project", { projectId: id }).then((raw) => setProject(JSON.parse(raw) as NewProjectPayload)).catch(() => setStatus("Failed to load project."));
  }, [id]);

  useEffect(() => {
    registerNavigationGuard({ isDirty: () => false, save: async () => undefined });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard]);

  useEffect(() => {
    regeneratePreview();
    return () => {
      invoke("cleanup_preview_pdf", { projectId: id }).catch(() => undefined);
    };
  }, [id, regeneratePreview]);

  const runExport = useCallback(async () => {
    if (!project) return;
    try {
      setIsGeneratingPdf(true);
      const selectedPath = await invoke<string | null>("pick_export_pdf_path", { defaultFileName: buildExportFileName(project.id) });
      if (!selectedPath) return;
      await invoke("export_pdf_to_path", { projectId: project.id, outputPath: selectedPath });
      setExportModal({ kind: "success", path: selectedPath });
    } catch (err) {
      const message = (err as ApiError)?.message ?? "unknown error";
      setExportModal({ kind: "error", message });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [project]);

  const saveProject = useCallback(async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      await invoke("save_project", { projectId: project.id, json: JSON.stringify(project, null, 2) });
      setStatus("Project saved.");
    } finally {
      setIsSaving(false);
    }
  }, [project]);

  return <section className="panel panel--preview"><div className="panel__header"><h2>PDF Preview</h2><button type="button" className="button-secondary" onClick={() => navigate("/")}>Cancel</button></div>
    <div className="pdf-preview-panel">
      <div className="preview-container">
        {loadingPreview ? <p className="subtle">Generating preview…</p> : null}
        {!loadingPreview && previewPath ? <iframe className="pdf-preview-object" src={previewPath} title="PDF preview" /> : null}
        {!loadingPreview && !previewPath ? <div className="status status--error"><p>{status || "Preview failed."}</p><button type="button" className="button-secondary" onClick={regeneratePreview}>Retry</button></div> : null}
      </div>
    </div>
    {status && previewPath ? <p className="status">{status}</p> : null}
    <div className="setup-action-bar setup-action-bar--equal"><button type="button" className="button-secondary" onClick={() => navigate(`/projects/${id}/setup`)}>Back to lineup setup</button><button type="button" className="button-secondary" onClick={saveProject} disabled={isSaving}>{isSaving ? "Saving…" : "Save project"}</button><button type="button" disabled={isGeneratingPdf} onClick={runExport}>{isGeneratingPdf ? "Generating…" : "Generate PDF"}</button></div>
    <ExportResultModal state={exportModal} onClose={() => setExportModal(null)} onRetry={runExport} />
  </section>;
}

export default App;
