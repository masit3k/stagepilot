import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildExportFileName } from "../../projectRules";
import { withFrom } from "../shell/routes";
import type { NewProjectPayload } from "../shell/types";
import {
  ExportResultModal,
  type ExportModalState,
} from "../modals/ExportResultModal";
import type { ProjectRouteProps } from "./shared/pageTypes";

type ApiError = { message?: string };

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
      // Uses slug (human doc key), not id (UUID).
      invoke("cleanup_preview_pdf", { previewKey: project?.slug || id }).catch(
        () => undefined,
      );
    };
  }, [id, regeneratePreview]);

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
