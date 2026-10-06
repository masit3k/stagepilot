import {
  ChooseProjectTypePage,
  LibraryBandFormPage,
  LibraryBandsPage,
  NewEventProjectPage,
  NewGenericProjectPage,
  ProjectInputsPage,
  ProjectPreviewPage,
  ProjectSetupPage,
  SettingsPage,
  StagePlanEditorPage,
  StartPage,
} from "../pages/ShellRoutedPages";
import type { BandOption, NavigationGuard, ProjectSummary } from "./types";
import {
  NEW_BAND_ROUTE_SEGMENT,
  matchLibraryBandDetailPath,
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectInputsPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
  matchProjectStageplanPath,
} from "./routes";

type NavigateFn = (path: string) => void;

type ShellRouterProps = {
  pathname: string;
  search: string;
  navigate: NavigateFn;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
  bands: BandOption[];
  projects: ProjectSummary[];
  refreshProjects: () => Promise<void>;
  refreshBands: () => Promise<void>;
  actions: {
    archiveProject: (project: ProjectSummary) => Promise<void>;
    unarchiveProject: (project: ProjectSummary) => Promise<void>;
    moveProjectToTrash: (project: ProjectSummary) => Promise<void>;
    restoreProject: (project: ProjectSummary) => Promise<void>;
    deleteProjectPermanently: (project: ProjectSummary) => Promise<void>;
  };
};

export function ShellRouter({
  pathname,
  search,
  navigate,
  registerNavigationGuard,
  bands,
  projects,
  refreshProjects,
  refreshBands,
  actions,
}: ShellRouterProps) {
  const eventEditProjectId = matchProjectEventPath(pathname);
  const genericEditProjectId = matchProjectGenericPath(pathname);
  const setupProjectId = matchProjectSetupPath(pathname);
  const inputsProjectId = matchProjectInputsPath(pathname);
  const stageplanProjectId = matchProjectStageplanPath(pathname);
  const previewProjectId = matchProjectPreviewPath(pathname);
  const libraryBandDetailId = matchLibraryBandDetailPath(pathname);
  const editOrigin = new URLSearchParams(search).get("from");
  const editFromPath = new URLSearchParams(search).get("fromPath");

  if (pathname === "/") {
    return (
      <StartPage
        projects={projects}
        navigate={navigate}
        onArchiveProject={actions.archiveProject}
        onUnarchiveProject={actions.unarchiveProject}
        onMoveProjectToTrash={actions.moveProjectToTrash}
        onRestoreProject={actions.restoreProject}
        onDeleteProjectPermanently={actions.deleteProjectPermanently}
      />
    );
  }

  if (pathname === "/projects/new") return <ChooseProjectTypePage navigate={navigate} />;
  if (pathname === "/projects/new/event") {
    return (
      <NewEventProjectPage
        bands={bands}
        navigate={navigate}
        onCreated={refreshProjects}
        registerNavigationGuard={registerNavigationGuard}
      />
    );
  }
  if (pathname === "/projects/new/generic") {
    return (
      <NewGenericProjectPage
        bands={bands}
        navigate={navigate}
        onCreated={refreshProjects}
        registerNavigationGuard={registerNavigationGuard}
      />
    );
  }
  if (eventEditProjectId) {
    return (
      <NewEventProjectPage
        bands={bands}
        navigate={navigate}
        onCreated={refreshProjects}
        editingProjectId={eventEditProjectId}
        registerNavigationGuard={registerNavigationGuard}
        origin={editOrigin}
        fromPath={editFromPath}
      />
    );
  }
  if (genericEditProjectId) {
    return (
      <NewGenericProjectPage
        bands={bands}
        navigate={navigate}
        onCreated={refreshProjects}
        editingProjectId={genericEditProjectId}
        registerNavigationGuard={registerNavigationGuard}
        origin={editOrigin}
        fromPath={editFromPath}
      />
    );
  }
  if (setupProjectId) {
    return (
      <ProjectSetupPage
        id={setupProjectId}
        navigate={navigate}
        registerNavigationGuard={registerNavigationGuard}
        search={search}
      />
    );
  }
  if (inputsProjectId) {
    return (
      <ProjectInputsPage
        id={inputsProjectId}
        navigate={navigate}
        registerNavigationGuard={registerNavigationGuard}
        search={search}
      />
    );
  }
  if (stageplanProjectId) {
    return (
      <StagePlanEditorPage
        id={stageplanProjectId}
        navigate={navigate}
        registerNavigationGuard={registerNavigationGuard}
        search={search}
      />
    );
  }
  if (previewProjectId) {
    return (
      <ProjectPreviewPage
        id={previewProjectId}
        navigate={navigate}
        registerNavigationGuard={registerNavigationGuard}
        search={search}
      />
    );
  }
  if (pathname === "/library" || pathname === "/library/bands") {
    return <LibraryBandsPage navigate={navigate} registerNavigationGuard={registerNavigationGuard} />;
  }
  if (libraryBandDetailId) {
    const bandId = libraryBandDetailId === NEW_BAND_ROUTE_SEGMENT ? null : libraryBandDetailId;
    return (
      <LibraryBandFormPage
        key={libraryBandDetailId}
        bandId={bandId}
        navigate={navigate}
        registerNavigationGuard={registerNavigationGuard}
        onBandSaved={refreshBands}
      />
    );
  }
  if (pathname === "/settings") return <SettingsPage />;

  return null;
}
