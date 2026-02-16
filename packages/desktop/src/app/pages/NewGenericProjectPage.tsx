import { invoke } from "@tauri-apps/api/core";
import { generateUuidV7 } from "../../../../../src/domain/projectNaming";
import { useCallback, useEffect, useRef, useState } from "react";
import { type LineupMap, formatProjectDisplayName, formatProjectSlug } from "../../projectRules";
import { getNavigationContextLabel } from "../shell/routes";
import type { BandSetupData, NewProjectPayload } from "../shell/types";
import { toPersistableProject } from "../shell/types";
import {
  getSetupPrimaryCtaLabel,
  isGenericSetupDirty,
  resolveSetupBackTarget,
  shouldSaveGenericSetupOnContinue,
} from "../shell/setupDirty";
import * as projectsApi from "../services/projectsApi";
import type { NewProjectPageProps } from "./shared/pageTypes";


export function NewGenericProjectPage({
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
  const initialSnapshotRef = useRef({
    bandRef: "",
    note: "",
    validityYear: "",
  });
  function validateValidityYear(raw: string): string | null {
    const value = raw.trim();

    if (!value) return "Year is required.";

    if (!/^\d{4}$/.test(value)) {
      return "Enter a valid year (YYYY).";
    }

    const year = Number(value);

    if (Number.isNaN(year)) return "Enter a valid year (YYYY).";

    if (year < currentYear) return "Year cannot be in the past.";
    if (year > maxYear)
      return `Year must be between ${currentYear} and ${maxYear}.`;

    return null;
  }

  const validityYearError = validityYearTouched
    ? validateValidityYear(validityYear)
    : null;
  const selectedBand = bands.find((band) => band.id === bandRef);
  const canSubmit = Boolean(
    selectedBand && !validateValidityYear(validityYear),
  );

  useEffect(() => {
    if (!editingProjectId) return;
    invoke<string>("read_project", { projectId: editingProjectId })
      .then((raw) => {
        const project = JSON.parse(raw) as NewProjectPayload;
        setBandRef(project.bandRef);
        setNote(project.note ?? "");
        setValidityYear(project.documentDate.slice(0, 4));
        initialSnapshotRef.current = {
          bandRef: project.bandRef ?? "",
          note: project.note ?? "",
          validityYear: project.documentDate.slice(0, 4),
        };
      })
      .catch(() => setStatus("Failed to load existing generic setup."));
  }, [editingProjectId]);

  const isDirty = isGenericSetupDirty(initialSnapshotRef.current, {
    bandRef,
    note,
    validityYear,
  });

  const persist = useCallback(
    async (targetId?: string) => {
      if (!selectedBand) return;
      const id = targetId ?? editingProjectId ?? generateUuidV7();
      const nowIso = new Date().toISOString();
      let defaultLineup: LineupMap | undefined;
      let defaultBandLeaderId = "";
      if (!editingProjectId) {
        try {
          const setupDefaults = await invoke<BandSetupData>(
            "get_band_setup_data",
            {
              bandId: selectedBand.id,
            },
          );
          defaultLineup = { ...(setupDefaults.defaultLineup ?? {}) };
          if (!Object.keys(defaultLineup).length) {
            console.error(
              "Band default lineup is empty during generic project creation",
              {
                bandRef: selectedBand.id,
              },
            );
          }
          defaultBandLeaderId = setupDefaults.bandLeader ?? "";
        } catch (error) {
          console.error(
            "Failed to load setup defaults for new generic project",
            {
              bandRef: selectedBand.id,
              error,
            },
          );
          defaultLineup = {};
        }
      }
      const payload: NewProjectPayload = {
        id,
        slug: formatProjectSlug(
          { purpose: "generic", documentDate: `${validityYear}-01-01`, note },
          selectedBand,
        ),
        displayName: formatProjectDisplayName(
          { purpose: "generic", documentDate: `${validityYear}-01-01`, note },
          selectedBand,
        ),
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
      await projectsApi.saveProject({
        projectId: id,
        json: JSON.stringify(toPersistableProject(payload), null, 2),
      });
      await onCreated();
      return id;
    },
    [editingProjectId, note, onCreated, selectedBand, validityYear],
  );

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => !isCommitting && isDirty,
      save: () => persist().then(() => undefined),
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, persist, isCommitting]);

  async function createProject() {
    const id = editingProjectId ?? generateUuidV7();
    if (!editingProjectId && !selectedBand) return;
    if (shouldSaveGenericSetupOnContinue(editingProjectId, isDirty)) {
      setIsCommitting(true);
      await persist(id);
    }
    navigate(`/projects/${encodeURIComponent(id)}/setup`);
  }

  const backTarget = resolveSetupBackTarget(editingProjectId, fromPath, origin);
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
          {getSetupPrimaryCtaLabel(editingProjectId)}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
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
