import { describe, expect, it } from "vitest";
import {
  autoFormatDateInput,
  getCurrentYearLocal,
  getTodayIsoLocal,
  matchProjectEventPath,
  matchProjectGenericPath,
  isValidityYearInPast,
  isPastIsoDate,
  matchProjectDetailPath,
  normalizeRoleConstraint,
  parseUsDateInput,
  resolveBandLeaderId,
  sanitizeVenueSlug,
} from "./projectRules";

describe("routing guards", () => {
  it("does not treat /projects/new as detail route", () => {
    expect(matchProjectDetailPath("/projects/new")).toBeNull();
  });

  it("matches normal project detail route", () => {
    expect(matchProjectDetailPath("/projects/cos_2026")).toBe("cos_2026");
  });

  it("matches canonical setup back routes", () => {
    expect(matchProjectEventPath("/projects/cos_2026/event")).toBe("cos_2026");
    expect(matchProjectGenericPath("/projects/cos_2026/generic")).toBe("cos_2026");
  });

  it("does not treat /projects/new/event as edit route", () => {
    expect(matchProjectEventPath("/projects/new/event")).toBeNull();
  });
});

describe("project id venue formatting", () => {
  it("builds title-cased hyphen venue slug without diacritics", () => {
    expect(sanitizeVenueSlug("Mladá Boleslav")).toBe("Mlada-Boleslav");
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

  it("gets local current year", () => {
    expect(getCurrentYearLocal(new Date("2026-02-11T20:12:00"))).toBe(2026);
  });

  it("flags validity year in the past", () => {
    expect(isValidityYearInPast("2025", 2026)).toBe(true);
  });

  it("allows current and future validity years", () => {
    expect(isValidityYearInPast("2026", 2026)).toBe(false);
    expect(isValidityYearInPast("2027", 2026)).toBe(false);
  });

  it("derives event document date from today instead of event date", () => {
    const documentDate = getTodayIsoLocal(new Date("2026-02-11T09:00:00"));
    const eventDate = "2026-03-02";
    expect(documentDate).toBe("2026-02-11");
    expect(documentDate).not.toBe(eventDate);
  });
});

describe("role constraints", () => {
  it("falls back to safe vocal max when constraints are invalid", () => {
    expect(normalizeRoleConstraint("vocs", { min: 0, max: 99 })).toEqual({
      min: 0,
      max: 4,
    });
  });

  it("prefers band JSON bandLeader for Couple of Sounds defaults", () => {
    expect(
      resolveBandLeaderId({
        selectedMusicianIds: ["krecmer_matej", "plasil_pavel"],
        bandLeaderId: "krecmer_matej",
        defaultContactId: "plasil_pavel",
      }),
    ).toBe("krecmer_matej");
  });
});
