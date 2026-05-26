import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildExportFileName } from "../../projectRules";
import { withFrom } from "../shell/routes";
import { mapExportError } from "../exportErrors";
import type { NewProjectPayload } from "../shell/types";
import {
  ExportResultModal,
  type ExportModalState,
} from "../modals/ExportResultModal";
import type { ProjectRouteProps } from "./shared/pageTypes";

export type PreviewRequestLifecycle = {
  startRequest: () => { accepted: boolean; requestId: number };
  isCurrentRequest: (requestId: number) => boolean;
  finishRequest: (requestId: number) => void;
  invalidateRequests: () => void;
};

export function createPreviewRequestLifecycle(): PreviewRequestLifecycle {
  let latestRequestId = 0;
  let inFlightRequestId: number | null = null;

  return {
    startRequest() {
      if (inFlightRequestId !== null) {
        return {
          accepted: false,
          requestId: latestRequestId,
        };
      }
      latestRequestId += 1;
      inFlightRequestId = latestRequestId;
      return { accepted: true, requestId: latestRequestId };
    },
    isCurrentRequest(requestId) {
      return requestId === latestRequestId;
    },
    finishRequest(requestId) {
      if (inFlightRequestId === requestId) {
        inFlightRequestId = null;
      }
    },
    invalidateRequests() {
      latestRequestId += 1;
      inFlightRequestId = null;
    },
  };
}

type PreviewState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "ready"; path: string }
  | { kind: "error"; message: string; missingPreview: boolean };

export function ProjectPreviewPage({
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
  const [hideMusicianNames, setHideMusicianNames] = useState(false);
  const [exportModal, setExportModal] = useState<ExportModalState>(null);
  const lifecycleRef = useRef<PreviewRequestLifecycle>(
    createPreviewRequestLifecycle(),
  );
  const hasSeenHideNamesEffect = useRef(false);
  const hideMusicianNamesRef = useRef(hideMusicianNames);
  const cleanupPreviewKeyRef = useRef(id);

  function releasePreviewUrl() {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  }

  const startPreviewGeneration = useCallback(async () => {
    const request = lifecycleRef.current.startRequest();
    if (!request.accepted) {
      return;
    }

    setPreviewState({ kind: "generating" });
    setStatus("");
    releasePreviewUrl();

    try {
      const result = await invoke<{ previewPdfPath: string }>(
        "build_project_pdf_preview",
        { projectId: id, hideMusicianNames: hideMusicianNamesRef.current },
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

      if (!lifecycleRef.current.isCurrentRequest(request.requestId)) {
        URL.revokeObjectURL(nextUrl);
        return;
      }

      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setPreviewState({ kind: "ready", path: result.previewPdfPath });
    } catch (err) {
      if (!lifecycleRef.current.isCurrentRequest(request.requestId)) {
        return;
      }

      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message ?? "Failed to generate preview.")
          : "Failed to generate preview.";
      setStatus(`Preview failed: ${message}`);
      const missingPreview = message.includes("os error 2");
      setPreviewState({
        kind: "error",
        message: missingPreview
          ? "Preview is no longer available because the temporary file was removed after export. Generate preview again."
          : `Preview failed: ${message}`,
        missingPreview,
      });
    } finally {
      lifecycleRef.current.finishRequest(request.requestId);
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
    hideMusicianNamesRef.current = hideMusicianNames;
  }, [hideMusicianNames]);

  useEffect(() => {
    cleanupPreviewKeyRef.current = project?.slug || id;
  }, [id, project?.slug]);

  useEffect(() => {
    hasSeenHideNamesEffect.current = false;
    startPreviewGeneration();

    return () => {
      lifecycleRef.current.invalidateRequests();
      releasePreviewUrl();
      // Uses slug (human doc key), not id (UUID).
      invoke("cleanup_preview_pdf", { previewKey: cleanupPreviewKeyRef.current }).catch(
        () => undefined,
      );
    };
  }, [id, startPreviewGeneration]);

  useEffect(() => {
    if (!hasSeenHideNamesEffect.current) {
      hasSeenHideNamesEffect.current = true;
      return;
    }

    startPreviewGeneration();
  }, [hideMusicianNames, startPreviewGeneration]);

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
        hideMusicianNames,
      });
      setExportModal({ kind: "success", path: selectedPath });
    } catch (err) {
      const mapped = mapExportError(err);
      setExportModal({
        kind: "error",
        message: mapped.userMessage,
        technical: mapped.technicalMessage,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [hideMusicianNames, project]);

  const isRegeneratingPreview = previewState.kind === "generating";

  const previewRoute = `${window.location.pathname}${search || ""}`;
  const backToEditPath =
    project?.purpose === "generic"
      ? withFrom(`/projects/${id}/generic`, "pdfPreview", previewRoute)
      : withFrom(`/projects/${id}/event`, "pdfPreview", previewRoute);

  return (
    <section className="panel panel--preview">
      <div className="panel__header">
        <div className="preview-header-copy">
          <h2>PDF Preview</h2>
          <div className="field preview-hide-names-field">
            <label className="preview-hide-names-label">
              <input
                type="checkbox"
                checked={hideMusicianNames}
                onChange={(event) => setHideMusicianNames(event.target.checked)}
              />
              <span>Hide musician names on stageplan</span>
            </label>
          </div>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
        >
          Back to Hub
        </button>
      </div>
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
                onClick={startPreviewGeneration}
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
          Edit Project
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() =>
            navigate(withFrom(`/projects/${id}/setup`, "preview", previewRoute))
          }
        >
          Edit Lineup
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={startPreviewGeneration}
          disabled={isRegeneratingPreview}
        >
          {isRegeneratingPreview ? "Regenerating…" : "Regenerate preview"}
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={isGeneratingPdf}
          onClick={runExport}
        >
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
