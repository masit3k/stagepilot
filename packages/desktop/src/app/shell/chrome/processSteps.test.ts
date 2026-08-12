import { describe, expect, it } from "vitest";
import { buildProcessSteps } from "./processSteps";

/** The trail only exists inside a project, so every other route returns null. */
const OUTSIDE_PROJECT = [
  "/",
  "/library",
  "/library/bands",
  "/settings",
  "/projects/new",
  "/projects/new/event",
  "/projects/p1/event",
  "/projects/p1/generic",
  "/nonsense",
];

describe("buildProcessSteps", () => {
  it("returns null outside a project", () => {
    for (const pathname of OUTSIDE_PROJECT) {
      expect(buildProcessSteps(pathname), pathname).toBeNull();
    }
  });

  it("numbers the four steps in order", () => {
    const trail = buildProcessSteps("/projects/p1/setup");
    expect(trail?.map((step) => [step.number, step.label])).toEqual([
      ["01", "LINEUP"],
      ["02", "INPUTS"],
      ["03", "STAGE PLAN"],
      ["04", "EXPORT"],
    ]);
  });

  it("marks lineup as the current step on the setup route", () => {
    const trail = buildProcessSteps("/projects/p1/setup");
    expect(trail?.find((step) => step.id === "lineup")?.state).toBe("current");
  });

  it("marks export as the current step on the preview route", () => {
    const trail = buildProcessSteps("/projects/p1/preview");
    expect(trail?.find((step) => step.id === "export")?.state).toBe("current");
  });

  it("offers the export step as a link while on lineup", () => {
    const trail = buildProcessSteps("/projects/p1/setup");
    const step = trail?.find((s) => s.id === "export");
    expect(step?.state).toBe("available");
    expect(step?.path).toBe("/projects/p1/preview");
  });

  it("offers the lineup step as a link while on export", () => {
    const trail = buildProcessSteps("/projects/p1/preview");
    const step = trail?.find((s) => s.id === "lineup");
    expect(step?.state).toBe("available");
    expect(step?.path).toBe("/projects/p1/setup");
  });

  it("gives the current step no path — it leads nowhere", () => {
    const trail = buildProcessSteps("/projects/p1/setup");
    expect(trail?.find((step) => step.id === "lineup")?.path).toBeNull();
  });

  it("leaves the steps without a screen unavailable and unlinked", () => {
    for (const pathname of ["/projects/p1/setup", "/projects/p1/preview"]) {
      const trail = buildProcessSteps(pathname);
      for (const id of ["inputs", "stageplan"] as const) {
        const step = trail?.find((s) => s.id === id);
        expect(step?.state, `${id} on ${pathname}`).toBe("unavailable");
        expect(step?.path, `${id} on ${pathname}`).toBeNull();
      }
    }
  });

  it("keeps the project id out of the step paths of another project", () => {
    const trail = buildProcessSteps("/projects/other-project/setup");
    expect(trail?.find((step) => step.id === "export")?.path).toBe(
      "/projects/other-project/preview",
    );
  });
});
