import { useEffect, useState } from "react";
import stagePilotIcon from "../../../assets/icons/StagePilot_Icon_StageLayout_CurrentColor.svg";
import desktopPackage from "../../../package.json";
import { TopTabs } from "../../pages/ShellPages";
import { AboutModal } from "../modals/AboutModal";
import { UnsavedChangesModal } from "../modals/UnsavedChangesModal";
import { useProjectsHubData } from "../pages/hub/useProjectsHubData";
import { ShellRouter } from "./ShellRouter";
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
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    const dark = saved === "dark";
    if (dark) document.documentElement.dataset.theme = "dark";
    return dark;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);
  const { projects, bands, status, refreshProjects, actions } =
    useProjectsHubData(navigateImmediate);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__icon-slot" aria-hidden="true">
            <img src={stagePilotIcon} className="app-header__icon" alt="" />
          </div>
          <div>
            <h1>StagePilot</h1>
            <p className="subtle">
              StagePilot v{desktopPackage.version} (Preview)
            </p>
          </div>
        </div>
        <div className="app-header__controls">
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="theme-toggle"
            onClick={() => setIsDark((d) => !d)}
          >
            <span className="theme-toggle__thumb">
              {isDark ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="theme-toggle__icon"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="theme-toggle__icon"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              )}
            </span>
          </button>
          <button
            type="button"
            className="button-secondary app-header__about-button"
            onClick={() => setIsAboutOpen(true)}
            aria-label="About StagePilot"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="app-header__about-icon"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" />
              <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
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
