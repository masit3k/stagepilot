import { describe, expect, it } from "vitest";
import {
  acceptISOToDDMMYYYY,
  addMusicianToLineupRole,
  addMusiciansToLineupRole,
  addMusiciansToLineupSlots,
  buildExportFileName,
  formatDateDigitsToDDMMYYYY,
  formatProjectDisplayName,
  formatProjectSlug,
  getCurrentYearLocal,
  getDefaultLineupSlotsForRole,
  getRoleDisplayName,
  getRoleSlotLimit,
  getTodayIsoLocal,
  getUniqueSelectedMusicians,
  isPastIsoDate,
  isValidityYearInPast,
  matchProjectDetailPath,
  matchProjectEventPath,
  matchProjectGenericPath,
  moveMusicianInLineupRole,
  normalizeCity,
  normalizeLineupSlots,
  normalizeLineupValue,
  parseDDMMYYYYToISO,
  parseUsDateInput,
  removeMusicianFromLineupRole,
  resolveBandLeaderId,
  sanitizeVenueSlug,
  shouldPromptUnsavedChanges,
  validateLineup,
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

describe("role slot limits", () => {
  it("uses static vocal slot limit", () => {
    expect(getRoleSlotLimit("vocs")).toBe(4);
  });

  it("uses static role labels", () => {
    expect(getRoleDisplayName("vocs")).toBe("VOCS");
  });

  it("validates lineup against static slot limits", () => {
    expect(
      validateLineup({ vocs: ["a", "b", "c", "d", "e"] }, ["vocs"]),
    ).toContain("VOCS: expected up to 4 slot(s), selected 5.");
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
      normalizeLineupSlots(
        {
          musicianId: "fuchs_tomas",
          presetOverride: { monitoring: { monitorRef: "iem_mono_wired" } },
        },
        1,
      ),
    ).toEqual([
      {
        musicianId: "fuchs_tomas",
        presetOverride: { monitoring: { monitorRef: "iem_mono_wired" } },
      },
    ]);
  });

  it("collects selected musician ids from mixed lineup shapes", () => {
    const selected = getUniqueSelectedMusicians(
      { guitar: { musicianId: "fuchs_tomas" }, bass: "krecmer_matej" },
      ["guitar", "bass"],
    );
    expect(selected.sort()).toEqual(["fuchs_tomas", "krecmer_matej"].sort());
  });

  it("ignores persisted null lineup slot entries", () => {
    expect(
      normalizeLineupSlots(
        [null] as unknown as Array<{ musicianId: string }>,
        1,
      ),
    ).toEqual([]);
  });

  it("ignores malformed slot values safely", () => {
    expect(
      normalizeLineupSlots(
        [42, false, { foo: "bar" }, undefined] as unknown as Array<{
          musicianId: string;
        }>,
        4,
      ),
    ).toEqual([]);
  });

  it("keeps valid string slots", () => {
    expect(normalizeLineupSlots(["fuchs_tomas"], 1)).toEqual([
      { musicianId: "fuchs_tomas" },
    ]);
  });

  it("deduplicates lineup slots while preserving the first occurrence", () => {
    expect(
      normalizeLineupSlots(
        [
          {
            musicianId: "dr-1",
            presetOverride: { monitoring: { monitorRef: "wedge" } },
          },
          { musicianId: "dr-2" },
          {
            musicianId: "dr-1",
            presetOverride: { monitoring: { monitorRef: "iem_mono_wired" } },
          },
        ],
        8,
      ),
    ).toEqual([
      {
        musicianId: "dr-1",
        presetOverride: { monitoring: { monitorRef: "wedge" } },
      },
      { musicianId: "dr-2" },
    ]);
  });

  it("deduplicates normalized lineup values before applying slot limits", () => {
    expect(normalizeLineupValue(["a", "a", "b"], 2)).toEqual(["a", "b"]);
  });

  it("adds a musician to a role without creating duplicates", () => {
    const lineup = { drums: ["dr-1"] };
    const updated = addMusicianToLineupRole(lineup, "drums", "dr-2");

    expect(updated.drums).toEqual([
      { musicianId: "dr-1" },
      { musicianId: "dr-2" },
    ]);
    expect(addMusicianToLineupRole(updated, "drums", "dr-2")).toBe(updated);
  });

  it("adds multiple musicians deterministically and skips duplicates", () => {
    const lineup = { drums: ["dr-1"] };
    const updated = addMusiciansToLineupRole(lineup, "drums", [
      "dr-3",
      "dr-2",
      "dr-1",
      "dr-3",
    ]);

    expect(updated.drums).toEqual([
      { musicianId: "dr-1" },
      { musicianId: "dr-3" },
      { musicianId: "dr-2" },
    ]);
    expect(addMusiciansToLineupRole(updated, "drums", ["dr-1"])).toBe(updated);
    expect(addMusiciansToLineupRole(updated, "drums", [])).toBe(updated);
  });

  it("adds multiple musicians to draft slots without exceeding role limits", () => {
    expect(
      addMusiciansToLineupSlots(["v-1", "v-2"], ["v-3", "v-1", "v-4"], 3),
    ).toEqual([
      { musicianId: "v-1" },
      { musicianId: "v-2" },
      { musicianId: "v-3" },
    ]);
  });

  it("resolves role defaults from band default lineup", () => {
    expect(
      getDefaultLineupSlotsForRole(
        {
          drums: ["dr-2", "dr-1", "dr-2"],
          bass: "b-1",
          guitar: null,
        },
        "drums",
      ),
    ).toEqual([{ musicianId: "dr-2" }, { musicianId: "dr-1" }]);
    expect(
      getDefaultLineupSlotsForRole({ bass: "b-1" }, "bass"),
    ).toEqual([{ musicianId: "b-1" }]);
    expect(
      getDefaultLineupSlotsForRole({ guitar: null }, "guitar"),
    ).toEqual([]);
    expect(getDefaultLineupSlotsForRole(undefined, "keys")).toEqual([]);
  });

  it("removes and reorders role musicians", () => {
    const lineup = { keys: ["k-1", "k-2", "k-3"] };

    expect(removeMusicianFromLineupRole(lineup, "keys", "k-2").keys).toEqual([
      { musicianId: "k-1" },
      { musicianId: "k-3" },
    ]);
    expect(moveMusicianInLineupRole(lineup, "keys", 0, -1)).toBe(lineup);
    expect(moveMusicianInLineupRole(lineup, "keys", 2, 3)).toBe(lineup);
    expect(moveMusicianInLineupRole(lineup, "keys", 0, 1).keys).toEqual([
      { musicianId: "k-2" },
      { musicianId: "k-1" },
      { musicianId: "k-3" },
    ]);
  });
});
