import {
  type ReactNode,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type ResolvedTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
  nextExplicitTheme,
  parseThemePreference,
  resolveTheme,
} from "./theme";

export type ThemeApi = {
  /** What the user chose — including "let the system decide". */
  readonly preference: ThemePreference;
  /** What is actually on screen. */
  readonly resolved: ResolvedTheme;
  readonly setPreference: (preference: ThemePreference) => void;
  /** The quick toggle: switch to the opposite of what is on screen. */
  readonly toggle: () => void;
};

export const ThemeContext = createContext<ThemeApi | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Owns the theme for the whole shell.
 *
 * Context rather than props: Settings renders deep inside the router, so prop
 * drilling the theme would touch every route. Same reasoning as ToastProvider.
 *
 * The decision logic lives in theme.ts as pure functions; this component owns
 * only React state, the `data-theme` attribute and the media query listener.
 * index.html stamps the same attribute before first paint, so the window never
 * flashes the wrong background — the provider then reads the stored preference
 * back rather than recomputing, so the two cannot disagree.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    readSystemPrefersDark,
  );

  // While the preference is "system" the OS is the source of truth, and it can
  // change while the app runs — that is the point of the setting.
  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia(DARK_QUERY);
    setSystemPrefersDark(query.matches);
    const onChange = (event: MediaQueryListEvent) =>
      setSystemPrefersDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const resolved = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const choose = useCallback((next: ThemePreference) => {
    setPreference(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const api = useMemo<ThemeApi>(
    () => ({
      preference,
      resolved,
      setPreference: choose,
      toggle: () => choose(nextExplicitTheme(resolved)),
    }),
    [preference, resolved, choose],
  );

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}
