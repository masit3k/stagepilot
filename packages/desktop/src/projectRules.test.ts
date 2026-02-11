import { describe, expect, it } from "vitest";
import {
  autoFormatDateInput,
  getTodayIsoLocal,
  isPastIsoDate,
  matchProjectDetailPath,
  normalizeRoleConstraint,
  parseUsDateInput,
} from "./projectRules";

describe("routing guards", () => {
  it("does not treat /projects/new as detail route", () => {
    expect(matchProjectDetailPath("/projects/new")).toBeNull();
  });

  it("matches normal project detail route", () => {
    expect(matchProjectDetailPath("/projects/cos_2026")).toBe("cos_2026");
  });
});

describe("event date rules", () => {
  it("parses DD/MM/YYYY input into ISO", () => {
    expect(parseUsDateInput("11/02/2026")).toBe("2026-02-11");
  });

  it("auto-formats date while typing", () => {
    expect(autoFormatDateInput("12032026")).toBe("12/03/2026");
  });

  it("rejects impossible dates", () => {
    expect(parseUsDateInput("31/02/2026")).toBeNull();
  });

  it("marks date before today as past", () => {
    expect(isPastIsoDate("2026-02-10", "2026-02-11")).toBe(true);
  });

  it("produces local today in ISO", () => {
    expect(getTodayIsoLocal(new Date("2026-02-11T20:12:00"))).toBe(
      "2026-02-11",
    );
  });
});

describe("role constraints", () => {
  it("falls back to safe vocal max when constraints are invalid", () => {
    expect(normalizeRoleConstraint("vocs", { min: 0, max: 99 })).toEqual({
      min: 0,
      max: 4,
    });
  });
});
