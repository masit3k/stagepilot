import { describe, expect, it } from "vitest";
import { describeBandUsage, parseBandUsages } from "./bandDeletion";

describe("parseBandUsages", () => {
  it("reads both kinds of blocking project", () => {
    const projects = [
      {
        kind: "usesBand",
        file: "BK_Konopiste.json",
        displayName: "Blanická kapela – 30/05/2026 – Konopiště",
        status: "archived",
      },
      { kind: "unreadable", file: "broken.json", message: "Invalid JSON" },
    ];

    expect(parseBandUsages(projects)).toEqual(projects);
  });

  it("drops entries without a file and ignores a value that is not a list", () => {
    expect(
      parseBandUsages([
        null,
        "x",
        { kind: "usesBand" },
        { kind: "usesBand", file: "a.json" },
      ]),
    ).toEqual([
      { kind: "usesBand", file: "a.json", displayName: null, status: null },
    ]);
    expect(parseBandUsages(undefined)).toEqual([]);
  });
});

describe("describeBandUsage", () => {
  it("shows the project name with its archived state", () => {
    expect(
      describeBandUsage({
        kind: "usesBand",
        file: "a.json",
        displayName: "Konopiště",
        status: "archived",
      }),
    ).toBe("Konopiště (archived)");
    expect(
      describeBandUsage({
        kind: "usesBand",
        file: "a.json",
        displayName: "Praha",
        status: "active",
      }),
    ).toBe("Praha");
  });

  it("falls back to the file name and labels a project in the trash", () => {
    expect(
      describeBandUsage({
        kind: "usesBand",
        file: "a.json",
        displayName: null,
        status: "trashed",
      }),
    ).toBe("a.json (in trash)");
  });

  it("names an unreadable file and why it could not be checked", () => {
    expect(
      describeBandUsage({
        kind: "unreadable",
        file: "broken.json",
        message: "Invalid JSON",
      }),
    ).toBe("broken.json — could not be checked (Invalid JSON)");
  });
});
