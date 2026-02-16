import { LibraryHomePage, SettingsPage } from "../../pages/ShellPages";
import {
  ChooseProjectTypePage,
  LibraryBandDetailPage,
  LibraryBandsPage,
  LibraryContactsPage,
  LibraryInstrumentsPage,
  LibraryMessagesPage,
  LibraryMusiciansPage,
  NewEventProjectPage,
  NewGenericProjectPage,
  ProjectPreviewPage,
  ProjectSetupPage,
  StartPage,
} from "../pages/ShellRoutedPages";
import type { BandOption, NavigationGuard, ProjectSummary } from "./types";
import {
  matchLibraryBandDetailPath,
  matchProjectEventPath,
  matchProjectGenericPath,
  matchProjectPreviewPath,
  matchProjectSetupPath,
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
  actions,
}: ShellRouterProps) {
  const eventEditProjectId = matchProjectEventPath(pathname);
  const genericEditProjectId = matchProjectGenericPath(pathname);
  const setupProjectId = matchProjectSetupPath(pathname);
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
  if (pathname === "/library") return <LibraryHomePage navigate={navigate} />;
  if (pathname === "/library/bands") {
    return <LibraryBandsPage navigate={navigate} registerNavigationGuard={registerNavigationGuard} />;
  }
  if (libraryBandDetailId) {
    return (
      <LibraryBandDetailPage
        bandId={libraryBandDetailId}
        navigate={navigate}
        registerNavigationGuard={registerNavigationGuard}
      />
    );
  }
  if (pathname === "/library/musicians") {
    return <LibraryMusiciansPage navigate={navigate} registerNavigationGuard={registerNavigationGuard} />;
  }
  if (pathname === "/library/instruments") {
    return <LibraryInstrumentsPage navigate={navigate} registerNavigationGuard={registerNavigationGuard} />;
  }
  if (pathname === "/library/contacts") {
    return <LibraryContactsPage navigate={navigate} registerNavigationGuard={registerNavigationGuard} />;
  }
  if (pathname === "/library/messages") {
    return <LibraryMessagesPage navigate={navigate} registerNavigationGuard={registerNavigationGuard} />;
  }
  if (pathname === "/settings") return <SettingsPage />;

  return null;
}
