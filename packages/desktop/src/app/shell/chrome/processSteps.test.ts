import { describe, expect, it } from "vitest";
import {
  type StepId,
  buildProcessSteps,
  nextStepPath,
  previousStepPath,
} from "./processSteps";

const ALL_STEPS: readonly StepId[] = [
  "lineup",
  "inputs",
  "stageplan",
  "export",
];

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

  it("marks the stage plan as the current step on its own route", () => {
    const trail = buildProcessSteps("/projects/p1/stageplan");
    const step = trail?.find((s) => s.id === "stageplan");
    expect(step?.state).toBe("current");
    expect(step?.path).toBeNull();
  });

  it("offers the stage plan as a link from the other project screens", () => {
    for (const pathname of ["/projects/p1/setup", "/projects/p1/preview"]) {
      const step = buildProcessSteps(pathname)?.find(
        (s) => s.id === "stageplan",
      );
      expect(step?.state, pathname).toBe("available");
      expect(step?.path, pathname).toBe("/projects/p1/stageplan");
    }
  });

  it("still offers lineup and export while on the stage plan", () => {
    const trail = buildProcessSteps("/projects/p1/stageplan");
    expect(trail?.find((s) => s.id === "lineup")?.path).toBe(
      "/projects/p1/setup",
    );
    expect(trail?.find((s) => s.id === "export")?.path).toBe(
      "/projects/p1/preview",
    );
  });

  it("keeps the project id out of the step paths of another project", () => {
    const trail = buildProcessSteps("/projects/other-project/setup");
    expect(trail?.find((step) => step.id === "export")?.path).toBe(
      "/projects/other-project/preview",
    );
  });

  it("makes the inputs step available from other project screens", () => {
    for (const pathname of [
      "/projects/p1/setup",
      "/projects/p1/preview",
      "/projects/p1/stageplan",
    ]) {
      const inputs = buildProcessSteps(pathname)?.find(
        (step) => step.id === "inputs",
      );

      expect(inputs?.state, pathname).toBe("available");
      expect(inputs?.path, pathname).toBe("/projects/p1/inputs");
    }
  });

  it("marks the inputs step as current on its own screen", () => {
    const trail = buildProcessSteps("/projects/p1/inputs");

    expect(trail?.map((step) => step.state)).toEqual([
      "available",
      "current",
      "available",
      "available",
    ]);
  });

  it("has no unavailable step left", () => {
    for (const pathname of [
      "/projects/p1/setup",
      "/projects/p1/inputs",
      "/projects/p1/stageplan",
      "/projects/p1/preview",
    ]) {
      const trail = buildProcessSteps(pathname);
      expect(
        trail?.every((step) => step.state !== "unavailable"),
        pathname,
      ).toBe(true);
    }
  });
});

describe("step flow targets", () => {
  it("leads forward through every step in order", () => {
    expect(nextStepPath("lineup", "p1")).toBe("/projects/p1/inputs");
    expect(nextStepPath("inputs", "p1")).toBe("/projects/p1/stageplan");
    expect(nextStepPath("stageplan", "p1")).toBe("/projects/p1/preview");
  });

  it("leads back through every step in order", () => {
    expect(previousStepPath("export", "p1")).toBe("/projects/p1/stageplan");
    expect(previousStepPath("stageplan", "p1")).toBe("/projects/p1/inputs");
    expect(previousStepPath("inputs", "p1")).toBe("/projects/p1/setup");
  });

  it("ends the process at both ends", () => {
    expect(nextStepPath("export", "p1")).toBeNull();
    expect(previousStepPath("lineup", "p1")).toBeNull();
  });

  it("never skips the inputs step in either direction", () => {
    // The regression this guards: `01` continued straight to `03` and `03`
    // went back straight to `01`, so `02` was unreachable from the flow.
    expect(nextStepPath("lineup", "p1")).not.toBe("/projects/p1/stageplan");
    expect(previousStepPath("stageplan", "p1")).not.toBe("/projects/p1/setup");
  });

  it("only leads to steps the trail also knows", () => {
    // Flow and trail read the same STEPS array; this pins them to each other.
    const trailPaths = new Set(
      ["/projects/p1/setup", "/projects/p1/inputs"].flatMap(
        (pathname) =>
          buildProcessSteps(pathname)
            ?.map((step) => step.path)
            .filter((path): path is string => path !== null) ?? [],
      ),
    );

    for (const step of ALL_STEPS) {
      for (const target of [
        nextStepPath(step, "p1"),
        previousStepPath(step, "p1"),
      ]) {
        if (target !== null) expect(trailPaths.has(target), target).toBe(true);
      }
    }
  });

  it("encodes the project id into the step paths", () => {
    expect(nextStepPath("lineup", "a b/c")).toBe("/projects/a%20b%2Fc/inputs");
  });
});
