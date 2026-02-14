import { describe, expect, it } from "vitest";
import {
  buildExportFileName,
  getCurrentYearLocal,
  getTodayIsoLocal,
  isPastIsoDate,
  isValidityYearInPast,
  matchProjectDetailPath,
  matchProjectEventPath,
  matchProjectGenericPath,
  normalizeCity,
  getRoleDisplayName,
  normalizeRoleConstraint,
  formatDateDigitsToDDMMYYYY,
  parseDDMMYYYYToISO,
  acceptISOToDDMMYYYY,
  parseUsDateInput,
  validateLineup,
  resolveBandLeaderId,
  formatProjectDisplayName,
  formatProjectSlug,
  sanitizeVenueSlug,
  shouldPromptUnsavedChanges,
  normalizeLineupSlots,
  getUniqueSelectedMusicians,
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
    expect(matchProjectGenericPath("/projects/cos_2026/generic")).toBe(
      "cos_2026",
    );
  });

  it("does not treat /projects/new/event as edit route", () => {
    expect(matchProjectEventPath("/projects/new/event")).toBeNull();
  });
});

describe("project naming formatting", () => {
  it("builds title-cased hyphen venue slug without diacritics", () => {
    expect(normalizeCity("Mladá Boleslav")).toBe("Mlada-Boleslav");
    expect(normalizeCity("Nové Město nad Metují")).toBe(
      "Nove-Mesto-Nad-Metuji",
    );
    expect(sanitizeVenueSlug("Mladá Boleslav")).toBe("Mlada-Boleslav");
  });

  it("builds event slug and displayName from canonical formatter", () => {
    const band = { id: "cos", code: "CoS", name: "Couple of Sounds" };
    const project = {
      purpose: "event" as const,
      eventDate: "2026-02-11",
      eventVenue: "Praha",
      documentDate: "2026-02-01",
    };
    expect(formatProjectSlug(project, band)).toBe(
      "CoS_Inputlist_Stageplan_11-02-2026_Praha",
    );
    expect(formatProjectDisplayName(project, band)).toBe(
      "Couple of Sounds – 11/02/2026 – Praha",
    );
  });
});

describe("event date rules", () => {
  it("parses DD/MM/YYYY input into ISO", () => {
    expect(parseUsDateInput("11/02/2026")).toBe("2026-02-11");
  });

  it("formats date digits to DD/MM/YYYY while typing", () => {
    expect(formatDateDigitsToDDMMYYYY("11032026")).toBe("11/03/2026");
    expect(formatDateDigitsToDDMMYYYY("1103")).toBe("11/03");
  });

  it("accepts strict DD/MM/YYYY parsing", () => {
    expect(parseDDMMYYYYToISO("11/03/2026")).toBe("2026-03-11");
    expect(parseDDMMYYYYToISO("31/02/2026")).toBeNull();
  });

  it("accepts ISO input and normalizes for display", () => {
    expect(parseUsDateInput("2026-03-11")).toBe("2026-03-11");
    expect(acceptISOToDDMMYYYY("2026-03-11")).toBe("11/03/2026");
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
});

describe("role constraints", () => {
  it("falls back to safe vocal max when constraints are invalid", () => {
    expect(normalizeRoleConstraint("vocs", { min: 0, max: 99 })).toEqual({
      min: 0,
      max: 4,
    });
  });

  it("uses roleConstraints.vocs.lead max to derive vocal label", () => {
    expect(
      getRoleDisplayName(
        "vocs",
        { vocs: { min: 0, max: 4 } },
        { vocs: { lead: { min: 0, max: 1 } } },
      ),
    ).toBe("LEAD VOC");
    expect(
      getRoleDisplayName(
        "vocs",
        { vocs: { min: 0, max: 1 } },
        { vocs: { lead: { min: 0, max: 2 } } },
      ),
    ).toBe("LEAD VOCS");
  });

  it("uses resolved vocal label in lineup validation", () => {
    expect(
      validateLineup({ vocs: [] }, { vocs: { min: 1, max: 2 } }, ["vocs"], {
        vocs: { lead: { min: 1, max: 1 } },
      }),
    ).toContain("LEAD VOC: expected 1-2 slot(s), selected 0.");
  });

  it("prefers band JSON bandLeader for defaults", () => {
    expect(
      resolveBandLeaderId({
        selectedMusicianIds: ["krecmer_matej", "plasil_pavel"],
        bandLeaderId: "krecmer_matej",
        defaultContactId: "plasil_pavel",
      }),
    ).toBe("krecmer_matej");
  });
});

describe("export behavior", () => {
  it("uses project slug as export PDF filename", () => {
    expect(
      buildExportFileName("CoS_Inputlist_Stageplan_11-02-2026_Mlada-Boleslav"),
    ).toBe("CoS_Inputlist_Stageplan_11-02-2026_Mlada-Boleslav.pdf");
  });
});

describe("unsaved changes", () => {
  it("prompts on route changes when form is dirty", () => {
    expect(shouldPromptUnsavedChanges(true, "route-change")).toBe(true);
  });

  it("prompts on browser history back when form is dirty", () => {
    expect(shouldPromptUnsavedChanges(true, "history-back")).toBe(true);
  });

  it("does not prompt when clean", () => {
    expect(shouldPromptUnsavedChanges(false, "route-change")).toBe(false);
  });
});


describe("lineup slot overrides", () => {
  it("normalizes object-based lineup slots", () => {
    expect(
      normalizeLineupSlots({ musicianId: "fuchs_tomas", presetOverride: { monitoring: { mode: "mono" } } }, 1),
    ).toEqual([{ musicianId: "fuchs_tomas", presetOverride: { monitoring: { mode: "mono" } } }]);
  });

  it("collects selected musician ids from mixed lineup shapes", () => {
    const selected = getUniqueSelectedMusicians(
      { guitar: { musicianId: "fuchs_tomas" }, bass: "krecmer_matej" },
      { guitar: { min: 0, max: 1 }, bass: { min: 0, max: 1 } },
      ["guitar", "bass"],
    );
    expect(selected.sort()).toEqual(["fuchs_tomas", "krecmer_matej"].sort());
  });
});
