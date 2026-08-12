/**
 * Theme preference logic, kept apart from React and from `window` so it can be
 * tested in the node environment the project uses.
 *
 * The preference has three states while the rendered theme has two. Those are
 * different things and conflating them is what made the old two-state toggle
 * unable to express "follow the system".
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * The storage key predates the third state. Keeping it means installs that
 * stored `light` or `dark` keep their choice with no migration step.
 */
export const THEME_STORAGE_KEY = "theme";

/** Anything unrecognised — including nothing stored — means follow the system. */
export function parseThemePreference(stored: string | null): ThemePreference {
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/**
 * What the quick toggle in the shell selects: the opposite of what is on screen,
 * always as an explicit preference. Returning to `system` is Settings' job.
 */
export function nextExplicitTheme(resolved: ResolvedTheme): ThemePreference {
  return resolved === "dark" ? "light" : "dark";
}
