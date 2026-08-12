import { describe, expect, it } from "vitest";
import { hasNativeWindowApi, titleBarProjectLabel } from "./windowChrome";

const PROJECTS = [
  {
    id: "p1",
    displayName: "Friday Night Band – 22.08.2026 – Bon Repos",
    slug: "fnb-2026-08-22",
  },
  { id: "p2", displayName: null, slug: "second-band-2026" },
  { id: "p3", displayName: null, slug: null },
];

describe("titleBarProjectLabel", () => {
  it("returns null where no project is open", () => {
    for (const pathname of [
      "/",
      "/library",
      "/library/bands",
      "/settings",
      "/projects/new",
    ]) {
      expect(titleBarProjectLabel(pathname, PROJECTS), pathname).toBeNull();
    }
  });

  it("names the open project on every project route", () => {
    for (const pathname of [
      "/projects/p1/setup",
      "/projects/p1/preview",
      "/projects/p1/event",
      "/projects/p1/generic",
    ]) {
      expect(titleBarProjectLabel(pathname, PROJECTS), pathname).toBe(
        "Friday Night Band – 22.08.2026 – Bon Repos",
      );
    }
  });

  it("treats the new-project route as no project", () => {
    // `/projects/new/event` looks like a project route but `new` is a literal.
    expect(titleBarProjectLabel("/projects/new/event", PROJECTS)).toBeNull();
    expect(titleBarProjectLabel("/projects/new/generic", PROJECTS)).toBeNull();
  });

  it("returns null for a project that is not in the list", () => {
    expect(titleBarProjectLabel("/projects/gone/setup", PROJECTS)).toBeNull();
  });

  it("falls back to the slug when the display name is missing", () => {
    expect(titleBarProjectLabel("/projects/p2/setup", PROJECTS)).toBe(
      "second-band-2026",
    );
  });

  it("never shows the raw id when neither name nor slug exists", () => {
    expect(titleBarProjectLabel("/projects/p3/setup", PROJECTS)).toBeNull();
  });
});

describe("hasNativeWindowApi", () => {
  it("is true when the Tauri bridge is present", () => {
    expect(hasNativeWindowApi({ __TAURI_INTERNALS__: {} })).toBe(true);
  });

  it("is false in a plain browser, where window controls would do nothing", () => {
    expect(hasNativeWindowApi({})).toBe(false);
  });
});
