import { describe, expect, it } from "vitest";
import {
  isGenericSetupDirty,
  resolveSetupBackTarget,
  shouldSaveGenericSetupOnContinue,
} from "./setupDirty";

describe("isGenericSetupDirty", () => {
  const initial = { bandRef: "band-1", note: "Tour A", validityYear: "2026" };

  it("returns false when values are unchanged", () => {
    expect(isGenericSetupDirty(initial, { ...initial })).toBe(false);
  });

  it("returns true when any field changes", () => {
    expect(
      isGenericSetupDirty(initial, {
        bandRef: "band-2",
        note: "Tour A",
        validityYear: "2026",
      }),
    ).toBe(true);
  });

  it("treats trimmed-equivalent values as unchanged", () => {
    expect(
      isGenericSetupDirty(initial, {
        bandRef: " band-1 ",
        note: "  Tour A  ",
        validityYear: " 2026 ",
      }),
    ).toBe(false);
  });

  it("returns to pristine after reverting to original value", () => {
    const changed = isGenericSetupDirty(initial, {
      bandRef: "band-1",
      note: "Tour B",
      validityYear: "2026",
    });
    const reverted = isGenericSetupDirty(initial, {
      bandRef: "band-1",
      note: "Tour A",
      validityYear: "2026",
    });

    expect(changed).toBe(true);
    expect(reverted).toBe(false);
  });
});

describe("generic continue/save decision", () => {
  it("does not save when editing and pristine", () => {
    expect(shouldSaveGenericSetupOnContinue("project-1", false)).toBe(false);
  });

  it("saves when editing and dirty", () => {
    expect(shouldSaveGenericSetupOnContinue("project-1", true)).toBe(true);
  });
});

describe("resolveSetupBackTarget", () => {
  it("prefers fromPath when provided", () => {
    expect(resolveSetupBackTarget("project-1", "/projects", "home")).toBe("/projects");
  });

  it("uses setup origin when available", () => {
    expect(resolveSetupBackTarget("project-1", null, "setup")).toBe("/projects/project-1/setup");
  });

  it("falls back to hub for edit pages", () => {
    expect(resolveSetupBackTarget("project-1", null, "home")).toBe("/");
  });
});
