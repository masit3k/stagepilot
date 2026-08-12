import { describe, expect, it } from "vitest";
import { nextExplicitTheme, parseThemePreference, resolveTheme } from "./theme";

describe("parseThemePreference", () => {
  it("accepts the three preferences", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("falls back to the system setting when nothing is stored", () => {
    // The behaviour F1 introduced: a fresh install follows the OS.
    expect(parseThemePreference(null)).toBe("system");
  });

  it("falls back to the system setting on a value it does not know", () => {
    expect(parseThemePreference("midnight")).toBe("system");
    expect(parseThemePreference("")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("ignores the system setting when the preference is explicit", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the system setting when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("nextExplicitTheme", () => {
  it("flips whichever theme is on screen, always to an explicit value", () => {
    expect(nextExplicitTheme("light")).toBe("dark");
    expect(nextExplicitTheme("dark")).toBe("light");
  });
});
