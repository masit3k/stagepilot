import { useCallback, useEffect, useState } from "react";
import { getTodayIsoLocal, isPastIsoDate } from "../../../projectRules";
import { refreshProjectsAndMigrate } from "../../services/projectMaintenance";
import * as projectsApi from "../../services/projectsApi";
import type { BandOption, NewProjectPayload, ProjectSummary } from "../../shell/types";
import { toPersistableProject } from "../../shell/types";

type NavigateImmediateFn = (path: string, replace?: boolean) => void;

export function useProjectsHubData(navigateImmediate: NavigateImmediateFn) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [bands, setBands] = useState<BandOption[]>([]);
  const [status, setStatus] = useState("");

  const refreshProjects = useCallback(async () => {
    const { projects: maintainedProjects, migratedIds } = await refreshProjectsAndMigrate();
    setProjects(maintainedProjects);
    const activePath = window.location.pathname;
    const match = activePath.match(/^\/projects\/([^/]+)/);
    if (match) {
      const activeId = decodeURIComponent(match[1]);
      const migratedId = migratedIds.get(activeId);
      if (migratedId) {
        const rerouted = activePath.replace(
          `/projects/${encodeURIComponent(activeId)}`,
          `/projects/${encodeURIComponent(migratedId)}`,
        );
        navigateImmediate(`${rerouted}${window.location.search || ""}`, true);
      }
    }
  }, [navigateImmediate]);

  const refreshBands = useCallback(async () => {
    setBands(await projectsApi.listBands());
  }, []);

  const updateProjectLifecycle = useCallback(
    async (
      projectId: string,
      updater: (project: NewProjectPayload, now: Date) => NewProjectPayload,
    ) => {
      const raw = await projectsApi.readProject(projectId);
      const project = JSON.parse(raw) as NewProjectPayload;
      const now = new Date();
      const updatedProject = updater(project, now);
      await projectsApi.saveProject({
        projectId,
        json: JSON.stringify(toPersistableProject(updatedProject), null, 2),
      });
      await refreshProjects();
    },
    [refreshProjects],
  );

  const archiveProject = useCallback(
    async (project: ProjectSummary) => {
      await updateProjectLifecycle(project.id, (source, now) => ({
        ...source,
        templateType: source.templateType ?? source.purpose,
        status: "archived",
        archivedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }));
      setStatus("Project archived.");
    },
    [updateProjectLifecycle],
  );

  const unarchiveProject = useCallback(
    async (project: ProjectSummary) => {
      await updateProjectLifecycle(project.id, (source, now) => ({
        ...source,
        templateType: source.templateType ?? source.purpose,
        status: "active",
        updatedAt: now.toISOString(),
      }));
      setStatus("Project moved to Active.");
    },
    [updateProjectLifecycle],
  );

  const moveProjectToTrash = useCallback(
    async (project: ProjectSummary) => {
      await updateProjectLifecycle(project.id, (source, now) => {
        const purgeAt = new Date(now);
        purgeAt.setDate(purgeAt.getDate() + 30);
        return {
          ...source,
          templateType: source.templateType ?? source.purpose,
          status: "trashed",
          trashedAt: now.toISOString(),
          purgeAt: purgeAt.toISOString(),
          updatedAt: now.toISOString(),
        };
      });
      setStatus("Project moved to Trash.");
    },
    [updateProjectLifecycle],
  );

  const restoreProject = useCallback(
    async (project: ProjectSummary) => {
      await updateProjectLifecycle(project.id, (source, now) => {
        const todayIso = getTodayIsoLocal(now);
        const templateType = source.templateType ?? source.purpose;
        const restoreStatus =
          templateType === "event" && source.eventDate && isPastIsoDate(source.eventDate, todayIso)
            ? "archived"
            : "active";
        return {
          ...source,
          templateType,
          status: restoreStatus,
          trashedAt: undefined,
          purgeAt: undefined,
          updatedAt: now.toISOString(),
        };
      });
      setStatus("Project restored.");
    },
    [updateProjectLifecycle],
  );

  const deleteProjectPermanently = useCallback(
    async (project: ProjectSummary) => {
      await projectsApi.deleteProjectPermanently(project.id);
      await refreshProjects();
      setStatus("Project permanently deleted.");
    },
    [refreshProjects],
  );

  useEffect(() => {
    void (async () => {
      await Promise.all([refreshProjects(), refreshBands()]);
    })().catch(() => setStatus("Failed to load initial data."));
  }, [refreshBands, refreshProjects]);

  return {
    projects,
    bands,
    status,
    refreshProjects,
    actions: {
      archiveProject,
      unarchiveProject,
      moveProjectToTrash,
      restoreProject,
      deleteProjectPermanently,
    },
  };
}
