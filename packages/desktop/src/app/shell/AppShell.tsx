import { useState } from "react";
import { AboutModal } from "../modals/AboutModal";
import { UnsavedChangesModal } from "../modals/UnsavedChangesModal";
import { useProjectsHubData } from "../pages/hub/useProjectsHubData";
import { ShellRouter } from "./ShellRouter";
import { ShellNav } from "./chrome/ShellNav";
import { TitleBar } from "./chrome/TitleBar";
import { useAppNavigation } from "./navigation/useAppNavigation";

function AppShell() {
  const {
    pathname,
    search,
    navigate,
    navigateImmediate,
    registerNavigationGuard,
    pendingNavigation,
    stayOnPage,
    exitWithoutSaving,
    saveAndExit,
  } = useAppNavigation();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const { projects, bands, status, refreshProjects, actions } =
    useProjectsHubData(navigateImmediate);

  return (
    <div className="app-window">
      <TitleBar pathname={pathname} projects={projects} />
      <main className="app-shell">
        <ShellNav
          pathname={pathname}
          navigate={navigate}
          onOpenAbout={() => setIsAboutOpen(true)}
        />
        {status ? (
          <p className="status status--error" role="alert">
            {status}
          </p>
        ) : null}
        <ShellRouter
          pathname={pathname}
          search={search}
          navigate={navigate}
          registerNavigationGuard={registerNavigationGuard}
          projects={projects}
          bands={bands}
          refreshProjects={refreshProjects}
          actions={actions}
        />
      </main>
      <AboutModal open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <UnsavedChangesModal
        open={Boolean(pendingNavigation)}
        onStay={stayOnPage}
        onExitWithoutSaving={exitWithoutSaving}
        onSaveAndExit={saveAndExit}
      />
    </div>
  );
}

export default AppShell;
