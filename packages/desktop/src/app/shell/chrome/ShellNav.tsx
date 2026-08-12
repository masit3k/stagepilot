import { Info, Moon, Sun } from "../../../components/ui/icons";
import { useTheme } from "../../providers/useTheme";
import { ProcessTrail } from "./ProcessTrail";
import { activeNavId, shellNavItems } from "./navItems";
import { buildProcessSteps } from "./processSteps";

/**
 * The one row under the title bar: sections on the left, context on the right.
 *
 * It replaced the separate application header, which duplicated the mark and the
 * app name the title bar now carries. The version moved to the About dialog,
 * which already listed it.
 */
export function ShellNav({
  pathname,
  navigate,
  onOpenAbout,
}: {
  pathname: string;
  navigate: (path: string) => void;
  onOpenAbout: () => void;
}) {
  const { resolved, toggle } = useTheme();
  const current = activeNavId(pathname);
  const steps = buildProcessSteps(pathname);
  const isDark = resolved === "dark";

  return (
    <div className="shell-nav">
      <nav className="shell-nav__sections" aria-label="Primary">
        {shellNavItems.map((item) => {
          const active = item.id === current;
          return (
            <button
              key={item.path}
              type="button"
              className={active ? "nav-pill is-active" : "nav-pill"}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="shell-nav__context">
        {steps === null ? null : (
          <ProcessTrail steps={steps} navigate={navigate} />
        )}
        {/* Two-state on purpose: it switches what is on screen. Returning to
            "follow the system" is a Settings decision, not a one-click one. */}
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="theme-toggle"
          onClick={toggle}
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
          className="button-secondary shell-nav__about"
          onClick={onOpenAbout}
          aria-label="About StagePilot"
        >
          <Info />
        </button>
      </div>
    </div>
  );
}
