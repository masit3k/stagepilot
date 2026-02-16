import { useState } from "react";
import { TopTabs } from "../../pages/ShellPages";
import stagePilotIcon from "../../../assets/icons/StagePilot_Icon_StageLayout_CurrentColor.svg";
import desktopPackage from "../../../package.json";
import { AboutModal } from "../modals/AboutModal";
import { UnsavedChangesModal } from "../modals/UnsavedChangesModal";
import { useProjectsHubData } from "../pages/hub/useProjectsHubData";
import { useAppNavigation } from "./navigation/useAppNavigation";
import { ShellRouter } from "./ShellRouter";

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
  const { projects, bands, status, refreshProjects, actions } = useProjectsHubData(navigateImmediate);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__icon-slot" aria-hidden="true">
            <img src={stagePilotIcon} className="app-header__icon" alt="" />
          </div>
          <div>
            <h1>StagePilot</h1>
            <p className="subtle">StagePilot v{desktopPackage.version} (Preview)</p>
          </div>
        </div>
        <button
          type="button"
          className="button-secondary app-header__about-button"
          onClick={() => setIsAboutOpen(true)}
          aria-label="About StagePilot"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="app-header__about-icon">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </header>
      <TopTabs pathname={pathname} navigate={navigate} />
      {status ? <p className="status status--error">{status}</p> : null}
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
      <AboutModal open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <UnsavedChangesModal
        open={Boolean(pendingNavigation)}
        onStay={stayOnPage}
        onExitWithoutSaving={exitWithoutSaving}
        onSaveAndExit={saveAndExit}
      />
    </main>
  );
}

export default AppShell;
