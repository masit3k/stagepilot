import { useContext } from "react";
import { type ThemeApi, ThemeContext } from "./ThemeProvider";

/**
 * Throws outside ThemeProvider rather than falling back to a light theme, which
 * would look like a styling bug instead of a wiring one.
 */
export function useTheme(): ThemeApi {
  const api = useContext(ThemeContext);
  if (!api) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return api;
}
