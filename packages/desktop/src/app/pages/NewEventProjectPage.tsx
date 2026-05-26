import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateUuidV7 } from "../../../../../src/domain/projectNaming";
import {
  acceptISOToDDMMYYYY,
  formatDateDigitsToDDMMYYYY,
  formatIsoDateToUs,
  formatProjectDisplayName,
  formatProjectSlug,
  getTodayIsoLocal,
  isPastIsoDate,
  parseDDMMYYYYToISO,
  parseUsDateInput,
} from "../../projectRules";
import * as projectsApi from "../services/projectsApi";
import { getNavigationContextLabel } from "../shell/routes";
import {
  getSetupPrimaryCtaLabel,
  isSetupInfoDirty,
  resolveSetupBackTarget,
} from "../shell/setupDirty";
import type { BandSetupData, NewProjectPayload } from "../shell/types";
import { toPersistableProject } from "../shell/types";
import { buildCanonicalProjectBaseFromBandDefaults } from "../shell/canonicalProject";
import { EventDateInput } from "./components/EventDateInput";
import type { NewProjectPageProps } from "./shared/pageTypes";
import { resolveProjectTalkbackOwnerId } from "./shared/talkbackPersistence";

export function NewEventProjectPage({
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

  const persist = useCallback(
    async (targetId?: string) => {
      if (!selectedBand || !eventDateIso || !eventVenue.trim()) return;
      const namingSource = {
        purpose: "event" as const,
        eventDate: eventDateIso,
        eventVenue,
        documentDate: todayIso,
      };
      const slug = formatProjectSlug(namingSource, selectedBand);
      const displayName = formatProjectDisplayName(namingSource, selectedBand);
      const id = targetId ?? editingProjectId ?? generateUuidV7();
      const nowIso = new Date().toISOString();
      let payload: NewProjectPayload = {
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
        lineup: existingProject?.lineup,
        overlays: existingProject?.overlays,
        bandLeaderId: existingProject?.bandLeaderId,
      };
      if (!editingProjectId) {
        try {
          const setupDefaults = await invoke<BandSetupData>(
            "get_band_setup_data",
            {
              bandId: selectedBand.id,
            },
          );
          if (!Object.keys(setupDefaults.defaultLineup ?? {}).length) {
            console.error(
              "Band default lineup is empty during event project creation",
              {
                bandRef: selectedBand.id,
              },
            );
          }
          payload = buildCanonicalProjectBaseFromBandDefaults({
            project: payload,
            setupDefaults,
            roleOrder: ["drums", "bass", "guitar", "keys", "vocs"],
            existingTalkbackOwnerId: existingProject
              ? resolveProjectTalkbackOwnerId(existingProject)
              : undefined,
          });
        } catch (error) {
          console.error("Failed to load setup defaults for new event project", {
            bandRef: selectedBand.id,
            error,
          });
          payload = {
            ...payload,
            lineup: {},
            bandLeaderId: undefined,
            overlays: {
              leadVocals: [],
              backVocals: [],
            },
          };
        }
      }
      await projectsApi.saveProject({
        projectId: id,
        json: JSON.stringify(toPersistableProject(payload), null, 2),
      });
      await onCreated();
      return id;
    },
    [
      selectedBand,
      eventDateIso,
      eventVenue,
      editingProjectId,
      todayIso,
      existingProject,
      onCreated,
    ],
  );

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => !isCommitting && isDirty,
      save: () => persist().then(() => undefined),
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, persist, isCommitting]);

  async function createProject() {
    console.info("[project-open] continue-click", {
      page: "NewEventProjectPage",
      editingProjectId: editingProjectId ?? null,
      isDirty,
    });
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
      console.info("[project-open] continue-navigate", {
        target: `/projects/${encodeURIComponent(id)}/setup`,
        persisted: false,
      });
      navigate(`/projects/${encodeURIComponent(id)}/setup`);
      return;
    }
    await persist(id);
    console.info("[project-open] continue-navigate", {
      target: `/projects/${encodeURIComponent(id)}/setup`,
      persisted: true,
    });
    navigate(`/projects/${encodeURIComponent(id)}/setup`);
  }

  const backTarget = resolveSetupBackTarget(editingProjectId, fromPath, origin);
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
            <p className="field-error" role="alert">
              {eventDateError}
            </p>
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
      {status ? (
        <p className="status status--error" role="alert">
          {status}
        </p>
      ) : null}
      <div className="setup-action-bar setup-action-bar--equal">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate(backTarget)}
        >
          {getSetupPrimaryCtaLabel(editingProjectId)}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate(exitTarget)}
        >
          Back to Hub
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={createProject}
          disabled={!canSubmit}
        >
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
