import { useEffect, useState } from "react";
import desktopPackage from "../../../package.json";
import { BrandMark } from "../../components/ui/BrandMark";
import { Info, Moon, Sun } from "../../components/ui/icons";
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
  const [isDark, setIsDark] = useState(
    // index.html has already resolved the theme before first paint — stored
    // preference first, system setting otherwise. Read it back rather than
    // recomputing, so the two can never disagree.
    () => document.documentElement.dataset.theme === "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);
  const { projects, bands, status, refreshProjects, actions } =
    useProjectsHubData(navigateImmediate);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__icon-slot" aria-hidden="true">
            <BrandMark size={24} className="app-header__icon" />
          </div>
          <div>
            <h1>StagePilot</h1>
            <p className="subtle">v{desktopPackage.version} · Preview</p>
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
                <Moon size={11} className="theme-toggle__icon" />
              ) : (
                <Sun size={11} className="theme-toggle__icon" />
              )}
            </span>
          </button>
          <button
            type="button"
            className="button-secondary app-header__about-button"
            onClick={() => setIsAboutOpen(true)}
            aria-label="About StagePilot"
          >
            <Info />
          </button>
        </div>
      </header>
      <TopTabs pathname={pathname} navigate={navigate} />
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
