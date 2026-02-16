import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from "react";
import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";
import { formatIsoToDateTimeDisplay } from "../../projectRules";
import { withFrom } from "../shell/routes";
import type { ProjectSummary } from "../shell/types";
import { ProjectContextMenuPortal } from "./components/ProjectContextMenuPortal";
import { formatProjectDate, getProjectPurposeLabel } from "./shared/projectHubUtils";

type ProjectStatusTab = "active" | "archived" | "trashed";

export type StartPageProps = {
  projects: ProjectSummary[];
  navigate: (path: string) => void;
  onArchiveProject: (project: ProjectSummary) => Promise<void>;
  onUnarchiveProject: (project: ProjectSummary) => Promise<void>;
  onMoveProjectToTrash: (project: ProjectSummary) => Promise<void>;
  onRestoreProject: (project: ProjectSummary) => Promise<void>;
  onDeleteProjectPermanently: (project: ProjectSummary) => Promise<void>;
};

export function StartPage({
  projects,
  navigate,
  onArchiveProject,
  onUnarchiveProject,
  onMoveProjectToTrash,
  onRestoreProject,
  onDeleteProjectPermanently,
}: StartPageProps) {
  const [viewMode, setViewMode] = useState<"list" | "tiles">(() =>
    localStorage.getItem("project-hub-view") === "tiles" ? "tiles" : "list",
  );
  const [activeTab, setActiveTab] = useState<ProjectStatusTab>("active");
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(
    null,
  );
  const [modalState, setModalState] = useState<
    | { kind: "trash"; project: ProjectSummary }
    | { kind: "archive"; project: ProjectSummary }
    | { kind: "unarchive"; project: ProjectSummary }
    | { kind: "deletePermanent"; project: ProjectSummary }
    | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmDialogRef = useModalBehavior(Boolean(modalState), () =>
    setModalState(null),
  );

  useEffect(() => {
    localStorage.setItem("project-hub-view", viewMode);
  }, [viewMode]);

  const sortedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.updatedAt ?? a.createdAt ?? 0).getTime(),
      ),
    [projects],
  );
  const projectsByTab = useMemo(
    () => ({
      active: sortedProjects.filter(
        (project) => (project.status ?? "active") === "active",
      ),
      archived: sortedProjects.filter(
        (project) => project.status === "archived",
      ),
      trashed: sortedProjects.filter((project) => project.status === "trashed"),
    }),
    [sortedProjects],
  );

  const visibleProjects = projectsByTab[activeTab];

  function projectEditPath(project: ProjectSummary) {
    const encodedId = encodeURIComponent(project.id);
    const templateType = project.templateType ?? project.purpose ?? "generic";
    const route =
      templateType === "event"
        ? `/projects/${encodedId}/event`
        : `/projects/${encodedId}/generic`;
    return `${route}?from=home`;
  }

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(".project-context-menu-shell") ||
        target.closest(".project-context-menu")
      )
        return;
      setOpenMenuProjectId(null);
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenuProjectId(null);
    };
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => document.removeEventListener("keydown", onDocumentKeyDown);
  }, []);

  async function confirmModalAction() {
    if (!modalState || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (modalState.kind === "trash")
        await onMoveProjectToTrash(modalState.project);
      if (modalState.kind === "archive")
        await onArchiveProject(modalState.project);
      if (modalState.kind === "unarchive")
        await onUnarchiveProject(modalState.project);
      if (modalState.kind === "deletePermanent") {
        await onDeleteProjectPermanently(modalState.project);
      }
      setModalState(null);
      setOpenMenuProjectId(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  function restoreProject(project: ProjectSummary) {
    onRestoreProject(project).catch(() => undefined);
    setOpenMenuProjectId(null);
  }

  function buildMenuItems(project: ProjectSummary) {
    const status = project.status ?? "active";
    if (status === "active") {
      return [
        {
          label: "Edit",
          onClick: () => navigate(projectEditPath(project)),
          danger: false,
        },
        {
          label: "Preview",
          onClick: () =>
            navigate(
              withFrom(
                `/projects/${encodeURIComponent(project.id)}/preview`,
                "home",
              ),
            ),
          danger: false,
        },
        {
          label: "Archive",
          onClick: () => setModalState({ kind: "archive", project }),
          danger: false,
        },
        {
          label: "Delete",
          onClick: () => setModalState({ kind: "trash", project }),
          danger: true,
        },
      ];
    }

    if (status === "archived") {
      return [
        {
          label: "Preview",
          onClick: () =>
            navigate(
              withFrom(
                `/projects/${encodeURIComponent(project.id)}/preview`,
                "home",
              ),
            ),
          danger: false,
        },
        {
          label: "Unarchive",
          onClick: () => setModalState({ kind: "unarchive", project }),
          danger: false,
        },
        {
          label: "Delete",
          onClick: () => setModalState({ kind: "trash", project }),
          danger: true,
        },
      ];
    }

    return [
      {
        label: "Restore",
        onClick: () => restoreProject(project),
        danger: false,
      },
      {
        label: "Delete permanently",
        onClick: () => setModalState({ kind: "deletePermanent", project }),
        danger: true,
      },
    ];
  }

  function renderProjectCard(project: ProjectSummary) {
    const isMenuOpen = openMenuProjectId === project.id;
    const projectLabel = project.displayName || project.slug || project.id;

    const onCardClick = () => {
      if (activeTab === "active") {
        navigate(projectEditPath(project));
        return;
      }
      if (activeTab === "archived") {
        navigate(
          withFrom(
            `/projects/${encodeURIComponent(project.id)}/preview`,
            "home",
          ),
        );
      }
    };

    const onCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (activeTab === "trashed") return;
      onCardClick();
    };

    const cardMenu = isMenuOpen ? (
      <ProjectContextMenuPortal
        project={project}
        projectLabel={projectLabel}
        onClose={() => setOpenMenuProjectId(null)}
      >
        {buildMenuItems(project).map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={
              item.danger
                ? "project-context-menu__item project-context-menu__item--danger"
                : "project-context-menu__item"
            }
            onClick={(event) => {
              event.stopPropagation();
              setOpenMenuProjectId(null);
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ))}
      </ProjectContextMenuPortal>
    ) : null;

    return (
      <article
        key={project.id}
        className={
          viewMode === "list"
            ? "project-card project-card--list project-surface"
            : "project-card project-surface"
        }
        role={activeTab === "trashed" ? undefined : "button"}
        tabIndex={activeTab === "trashed" ? -1 : 0}
        onClick={onCardClick}
        onKeyDown={onCardKeyDown}
        aria-label={
          activeTab === "archived"
            ? `Preview ${projectLabel}`
            : `Edit ${projectLabel}`
        }
      >
        <div className="project-main-action__content">
          <strong>{projectLabel}</strong>
          <span>
            {getProjectPurposeLabel(project.templateType ?? project.purpose)}
          </span>
          <span>Last updated: {formatProjectDate(project)}</span>
          {activeTab === "trashed" && project.purgeAt ? (
            <span>
              Scheduled for deletion on:{" "}
              {formatIsoToDateTimeDisplay(project.purgeAt)}
            </span>
          ) : null}
        </div>
        <div className="project-context-menu-shell">
          <button
            type="button"
            className="project-kebab"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls={
              isMenuOpen ? `project-menu-${project.id}` : undefined
            }
            aria-label={`Open actions for ${projectLabel}`}
            onClick={(event) => {
              event.stopPropagation();
              setOpenMenuProjectId((current) =>
                current === project.id ? null : project.id,
              );
            }}
          >
            ⋯
          </button>
          {cardMenu}
        </div>
      </article>
    );
  }

  function getEmptyStateCopy(tab: ProjectStatusTab) {
    if (tab === "active") return "No active projects.";
    if (tab === "archived") return "No archived projects.";
    return "Trash is empty.";
  }

  return (
    <section className="panel">
      <div className="panel__header panel__header--hub">
        <h2>Project Hub</h2>
      </div>
      <div className="actions-row actions-row--top">
        <button
          type="button"
          className="button-primary button-primary--large"
          onClick={() => navigate("/projects/new")}
        >
          + New Project
        </button>
        <div className="view-toggle" role="group" aria-label="Project layout">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            className={
              viewMode === "list"
                ? "button-secondary view-toggle__icon is-active"
                : "button-secondary view-toggle__icon"
            }
            onClick={() => setViewMode("list")}
          >
            ≣
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={viewMode === "tiles"}
            className={
              viewMode === "tiles"
                ? "button-secondary view-toggle__icon is-active"
                : "button-secondary view-toggle__icon"
            }
            onClick={() => setViewMode("tiles")}
          >
            ⊞
          </button>
        </div>
      </div>
      <div className="hub-tabs" role="tablist" aria-label="Project status tabs">
        {(["active", "archived", "trashed"] as ProjectStatusTab[]).map(
          (tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={
                activeTab === tab
                  ? "button-secondary is-active"
                  : "button-secondary"
              }
              onClick={() => {
                setActiveTab(tab);
                setOpenMenuProjectId(null);
              }}
            >
              {tab === "active"
                ? "Active"
                : tab === "archived"
                  ? "Archived"
                  : "Trash"}
            </button>
          ),
        )}
      </div>
      {visibleProjects.length === 0 ? (
        <p className="subtle">{getEmptyStateCopy(activeTab)}</p>
      ) : (
        <div className="project-sections">
          <section className="project-section">
            <div
              className={
                viewMode === "list"
                  ? "project-list project-list--rows"
                  : "project-list"
              }
            >
              {visibleProjects.map(renderProjectCard)}
            </div>
          </section>
        </div>
      )}
      <ModalOverlay
        open={Boolean(modalState)}
        onClose={() => setModalState(null)}
      >
        <div
          className="selector-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="project-action-title"
          aria-describedby="project-action-body"
          ref={confirmDialogRef}
        >
          <h3 id="project-action-title">
            {modalState?.kind === "trash"
              ? "Delete project?"
              : modalState?.kind === "archive"
                ? "Archive project?"
                : modalState?.kind === "unarchive"
                  ? "Unarchive project?"
                  : "Delete permanently?"}
          </h3>
          <p id="project-action-body">
            {modalState?.kind === "trash"
              ? "This will move the project to Trash. It will be permanently deleted after 30 days."
              : modalState?.kind === "archive"
                ? "You can restore it anytime from Archived."
                : modalState?.kind === "unarchive"
                  ? "The project will return to Active."
                  : "This action cannot be undone."}
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setModalState(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={
                modalState?.kind === "archive" ||
                modalState?.kind === "unarchive"
                  ? "button-primary"
                  : "button-danger"
              }
              onClick={confirmModalAction}
              disabled={isSubmitting}
            >
              {modalState?.kind === "trash"
                ? "Delete"
                : modalState?.kind === "archive"
                  ? "Archive"
                  : modalState?.kind === "unarchive"
                    ? "Unarchive"
                    : "Delete permanently"}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </section>
  );
}

