import { describe, expect, it } from "vitest";
import type { Group } from "../model/groups";
import type { Band, Contact, Musician } from "../model/types";
import {
  type BandDraft,
  type BandDraftContext,
  type BuildBandResult,
  buildBandFromDraft,
} from "./buildBandFromDraft";

function musician(
  id: string,
  group: Group,
  firstName: string,
  lastName: string,
): Musician {
  return { id, firstName, lastName, group, presets: [] };
}

const MUSICIANS: readonly Musician[] = [
  musician("plasil_pavel", "drums", "Pavel", "Plašil"),
  musician("krecmer_matej", "bass", "Matěj", "Krečmer"),
  musician("pisa_karel", "guitar", "Karel", "Píša"),
  musician("fuchs_tomas", "guitar", "Tomáš", "Fuchs"),
  musician("zidek_jakub", "keys", "Jakub", "Žídek"),
  musician("krecmerova_eliska", "vocs", "Eliška", "Krečmerová"),
  musician("holoubek_lukas", "vocs", "Lukáš", "Holoubek"),
];

const SINGERS = new Set([
  "plasil_pavel",
  "krecmer_matej",
  "zidek_jakub",
  "krecmerova_eliska",
  "holoubek_lukas",
]);

function context(overrides: Partial<BandDraftContext> = {}): BandDraftContext {
  return {
    existingBandIds: new Set(["blanicka_kapela"]),
    existingCodes: new Set(["bk"]),
    reservedIds: new Set(["new"]),
    musiciansById: Object.fromEntries(MUSICIANS.map((item) => [item.id, item])),
    canSing: (musicianId) => SINGERS.has(musicianId),
    ...overrides,
  };
}

const BNB_LINEUP = {
  drums: ["plasil_pavel"],
  bass: ["krecmer_matej"],
  guitar: ["pisa_karel"],
  keys: ["zidek_jakub"],
  vocs: ["krecmerova_eliska"],
};

function bnbDraft(overrides: Partial<BandDraft> = {}): BandDraft {
  return {
    name: "Big Night Band",
    code: "BNB",
    bandLeaderId: "krecmer_matej",
    lineup: BNB_LINEUP,
    leadVocalIds: ["krecmerova_eliska"],
    contact: {
      musicianId: "krecmer_matej",
      phone: "+420731247870",
      email: "matej@krecmer.eu",
    },
    ...overrides,
  };
}

function emptyDraft(overrides: Partial<BandDraft> = {}): BandDraft {
  return {
    name: "Nová kapela",
    code: "NK",
    lineup: {},
    leadVocalIds: [],
    ...overrides,
  };
}

const EXISTING_BNB: Band = {
  type: "band",
  id: "big_night_band",
  code: "BNB",
  name: "Big Night Band",
  bandLeader: "krecmer_matej",
  bandLeaderId: "krecmer_matej",
  defaultContactId: "krecmer_matej",
  defaultTalkbackOwnerId: "krecmer_matej",
  defaultLineup: BNB_LINEUP,
  defaultOverlays: {
    leadVocals: ["krecmerova_eliska"],
    backVocals: ["plasil_pavel", "krecmer_matej", "zidek_jakub"],
  },
};

function expectOk(result: BuildBandResult): { band: Band; contact?: Contact } {
  if (!result.ok) {
    throw new Error(`expected ok, got ${JSON.stringify(result.errors)}`);
  }
  return result;
}

function fieldsOf(result: BuildBandResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.field);
}

function messagesOf(result: BuildBandResult): string[] {
  return result.ok ? [] : result.errors.map((error) => error.message);
}

describe("buildBandFromDraft — valid drafts", () => {
  it("builds the canonical shape of big_night_band.json", () => {
    const { band } = expectOk(buildBandFromDraft(bnbDraft(), context()));

    expect(band).toEqual({
      type: "band",
      id: "big_night_band",
      code: "BNB",
      name: "Big Night Band",
      bandLeader: "krecmer_matej",
      bandLeaderId: "krecmer_matej",
      defaultTalkbackOwnerId: "krecmer_matej",
      defaultContactId: "krecmer_matej",
      defaultLineup: BNB_LINEUP,
      defaultOverlays: {
        leadVocals: ["krecmerova_eliska"],
        backVocals: ["plasil_pavel", "krecmer_matej", "zidek_jakub"],
      },
    });
  });

  it("builds the contact from the musician's name", () => {
    const { contact } = expectOk(buildBandFromDraft(bnbDraft(), context()));

    expect(contact).toEqual({
      id: "krecmer_matej",
      firstName: "Matěj",
      lastName: "Krečmer",
      phone: "+420731247870",
      email: "matej@krecmer.eu",
    });
  });

  it("trims the contact and omits an empty e-mail", () => {
    const { contact } = expectOk(
      buildBandFromDraft(
        bnbDraft({
          contact: {
            musicianId: "krecmer_matej",
            phone: " +420 1 ",
            email: "  ",
          },
        }),
        context(),
      ),
    );

    expect(contact).toEqual({
      id: "krecmer_matej",
      firstName: "Matěj",
      lastName: "Krečmer",
      phone: "+420 1",
    });
    expect(contact !== undefined && "email" in contact).toBe(false);
  });

  it("saves a band with only a name and a code", () => {
    const result = expectOk(buildBandFromDraft(emptyDraft(), context()));

    expect(result.band).toEqual({
      type: "band",
      id: "nova_kapela",
      code: "NK",
      name: "Nová kapela",
      bandLeader: "",
      bandLeaderId: "",
      defaultTalkbackOwnerId: "",
      defaultLineup: { drums: [], bass: [], guitar: [], keys: [], vocs: [] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    });
    expect(result.contact).toBeUndefined();
  });

  it("derives back vocals from canSing, not from the draft", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({
          lineup: {
            ...BNB_LINEUP,
            vocs: ["krecmerova_eliska", "holoubek_lukas"],
          },
        }),
        context(),
      ),
    );

    expect(band.defaultOverlays).toEqual({
      leadVocals: ["krecmerova_eliska"],
      backVocals: [
        "plasil_pavel",
        "krecmer_matej",
        "zidek_jakub",
        "holoubek_lukas",
      ],
    });
  });

  it("normalises the code to upper case", () => {
    const { band } = expectOk(
      buildBandFromDraft(bnbDraft({ code: " bnb " }), context()),
    );

    expect(band.code).toBe("BNB");
  });

  it("silently drops a duplicate inside one group", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({
          lineup: { ...BNB_LINEUP, drums: ["plasil_pavel", "plasil_pavel"] },
        }),
        context(),
      ),
    );

    expect(band.defaultLineup.drums).toEqual(["plasil_pavel"]);
  });

  it("keeps existingId when a band is renamed", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ name: "Big Night Orchestra", existingId: "big_night_band" }),
        context({ existingBand: EXISTING_BNB }),
      ),
    );

    expect(band.id).toBe("big_night_band");
    expect(band.name).toBe("Big Night Orchestra");
  });

  it("preserves notesTemplateRef and logoFile of the edited band", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ existingId: "big_night_band" }),
        context({
          existingBand: {
            ...EXISTING_BNB,
            notesTemplateRef: "notes_custom",
            logoFile: "logo.png",
          },
        }),
      ),
    );

    expect(band.notesTemplateRef).toBe("notes_custom");
    expect(band.logoFile).toBe("logo.png");
  });

  it("keeps the edited band's talkback owner while they stay in the lineup", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ existingId: "big_night_band" }),
        context({
          existingBand: {
            ...EXISTING_BNB,
            defaultTalkbackOwnerId: "plasil_pavel",
          },
        }),
      ),
    );

    expect(band.defaultTalkbackOwnerId).toBe("plasil_pavel");
  });

  it("falls back to the band leader when the talkback owner left the lineup", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ existingId: "big_night_band" }),
        context({
          existingBand: {
            ...EXISTING_BNB,
            defaultTalkbackOwnerId: "nyvlt_jakub",
          },
        }),
      ),
    );

    expect(band.defaultTalkbackOwnerId).toBe("krecmer_matej");
  });

  it("drops defaultContactId when the contact is switched off", () => {
    const { band } = expectOk(
      buildBandFromDraft(
        bnbDraft({ existingId: "big_night_band", contact: undefined }),
        context({ existingBand: EXISTING_BNB }),
      ),
    );

    expect("defaultContactId" in band).toBe(false);
  });
});

describe("buildBandFromDraft — identity errors", () => {
  it("rejects an empty name", () => {
    expect(
      fieldsOf(buildBandFromDraft(emptyDraft({ name: "  " }), context())),
    ).toEqual(["name"]);
  });

  it("rejects a name without letters or digits", () => {
    expect(
      fieldsOf(buildBandFromDraft(emptyDraft({ name: "!!!" }), context())),
    ).toEqual(["name"]);
  });

  it("rejects a new band whose id already exists", () => {
    const result = buildBandFromDraft(
      emptyDraft({ name: "Blanická kapela", code: "BLK" }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["name"]);
    expect(messagesOf(result)).toEqual([
      "A band with this name already exists.",
    ]);
  });

  it("rejects an id that equals another band's code alias", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(emptyDraft({ name: "BK", code: "BKX" }), context()),
      ),
    ).toEqual(["name"]);
  });

  it("rejects a reserved id", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(emptyDraft({ name: "New", code: "NEW" }), context()),
      ),
    ).toEqual(["name"]);
  });

  it("rejects codes outside [A-Z0-9]{2,6}", () => {
    for (const code of ["B", "ABCDEFG", "B-1", ""]) {
      expect(
        fieldsOf(buildBandFromDraft(emptyDraft({ code }), context())),
        code,
      ).toEqual(["code"]);
    }
  });

  it("rejects a code another band uses, regardless of case", () => {
    expect(
      fieldsOf(buildBandFromDraft(emptyDraft({ code: "bk" }), context())),
    ).toEqual(["code"]);
  });

  it("rejects a code that equals another band's id", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(
          emptyDraft({ code: "PL2" }),
          context({ existingBandIds: new Set(["pl2"]) }),
        ),
      ),
    ).toEqual(["code"]);
  });
});

describe("buildBandFromDraft — lineup and role errors", () => {
  it("requires a band leader once the lineup is not empty", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(bnbDraft({ bandLeaderId: undefined }), context()),
      ),
    ).toEqual(["bandLeader"]);
  });

  it("requires the band leader to be in the lineup", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(
          bnbDraft({ bandLeaderId: "fuchs_tomas" }),
          context(),
        ),
      ),
    ).toEqual(["bandLeader"]);
  });

  it("rejects a lead vocalist outside the lineup instead of dropping them", () => {
    const result = buildBandFromDraft(
      bnbDraft({ leadVocalIds: ["krecmerova_eliska", "holoubek_lukas"] }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["leadVocals"]);
    expect(messagesOf(result)).toEqual([
      "Holoubek Lukáš is not in the lineup.",
    ]);
  });

  it("rejects a contact outside the lineup", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(
          bnbDraft({ contact: { musicianId: "fuchs_tomas", phone: "1" } }),
          context(),
        ),
      ),
    ).toEqual(["contact"]);
  });

  it("rejects a contact without phone and e-mail", () => {
    expect(
      fieldsOf(
        buildBandFromDraft(
          bnbDraft({
            contact: { musicianId: "krecmer_matej", phone: " ", email: "" },
          }),
          context(),
        ),
      ),
    ).toEqual(["contact"]);
  });

  it("rejects a musician placed in two groups", () => {
    const result = buildBandFromDraft(
      bnbDraft({
        lineup: { ...BNB_LINEUP, vocs: ["krecmerova_eliska", "krecmer_matej"] },
      }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["lineup", "lineup"]);
    expect(messagesOf(result)).toContain(
      "Krečmer Matěj is in both bass and vocs.",
    );
  });

  it("rejects a musician from another group", () => {
    const result = buildBandFromDraft(
      bnbDraft({
        lineup: { ...BNB_LINEUP, drums: ["pisa_karel"], guitar: [] },
      }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["lineup"]);
    expect(messagesOf(result)).toEqual(["Píša Karel plays guitar, not drums."]);
  });

  it("rejects a musician who is not in the library", () => {
    const result = buildBandFromDraft(
      bnbDraft({ lineup: { ...BNB_LINEUP, drums: ["ghost_drummer"] } }),
      context(),
    );

    expect(fieldsOf(result)).toEqual(["lineup"]);
    expect(messagesOf(result)).toEqual([
      "Musician 'ghost_drummer' is not in your library.",
    ]);
  });

  it("collects every error at once", () => {
    const fields = fieldsOf(
      buildBandFromDraft(
        emptyDraft({
          name: "",
          code: "X",
          lineup: { bass: ["krecmer_matej"] },
        }),
        context(),
      ),
    );

    expect(fields).toEqual(
      expect.arrayContaining(["name", "code", "bandLeader"]),
    );
  });
});
