import { describe, expect, it } from "vitest";
import { buildBandDraftContext } from "../../../../../../src/domain/band/buildBandDraftContext";
import { buildBandFromDraft } from "../../../../../../src/domain/band/buildBandFromDraft";
import type { Band, Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  type CanSing,
  addBackVocals,
  addMembersToGroup,
  availableMusiciansForGroup,
  backVocalCandidates,
  bandFormFromBand,
  createEmptyBandForm,
  defaultContactMemberId,
  disableContact,
  removeBackVocal,
  removeMember,
  setBandCode,
  setBandLeader,
  setBandName,
  setContactField,
  setContactMember,
  toBandDraft,
} from "./bandFormModel";

const MUSICIANS: Musician[] = [
  {
    id: "plasil_pavel",
    firstName: "Pavel",
    lastName: "Plašil",
    group: "drums",
    presets: [],
  },
  {
    id: "nyvlt_jakub",
    firstName: "Jakub",
    lastName: "Nývlt",
    group: "drums",
    presets: [],
  },
  {
    id: "ernst_filip",
    firstName: "Filip",
    lastName: "Ernst",
    group: "drums",
    presets: [],
  },
  {
    id: "krecmer_matej",
    firstName: "Matěj",
    lastName: "Krečmer",
    group: "bass",
    presets: [],
  },
  {
    id: "krecmerova_eliska",
    firstName: "Eliška",
    lastName: "Krečmerová",
    group: "vocs",
    presets: [],
  },
];

const BAND_FILE: Band = {
  type: "band",
  id: "big_night_band",
  code: "BNB",
  name: "Big Night Band",
  bandLeader: "",
  bandLeaderId: "krecmer_matej",
  defaultContactId: "krecmer_matej",
  defaultLineup: {
    drums: ["plasil_pavel"],
    bass: ["krecmer_matej"],
    vocs: ["krecmerova_eliska"],
  },
  defaultOverlays: {
    leadVocals: ["krecmerova_eliska"],
    backVocals: ["plasil_pavel"],
  },
};

const SINGERS = new Set([
  "plasil_pavel",
  "nyvlt_jakub",
  "ernst_filip",
  "krecmer_matej",
  "krecmerova_eliska",
]);
const canSing: CanSing = (musicianId) => SINGERS.has(musicianId);
const nobodySings: CanSing = () => false;

function withLineup(): BandFormState {
  let state = createEmptyBandForm();
  state = addMembersToGroup(state, "drums", ["plasil_pavel"], canSing);
  state = addMembersToGroup(state, "bass", ["krecmer_matej"], canSing);
  return addMembersToGroup(state, "vocs", ["krecmerova_eliska"], canSing);
}

/** Bubeník, který nezpívá, a zpěvačka: BACK VOCS zůstanou prázdné. */
function silentDrummerAndSinger(): BandFormState {
  const state = addMembersToGroup(
    createEmptyBandForm(),
    "drums",
    ["nyvlt_jakub"],
    nobodySings,
  );
  return addMembersToGroup(state, "vocs", ["krecmerova_eliska"], nobodySings);
}

describe("bandFormModel", () => {
  it("derives the code from the name until the user edits it", () => {
    const named = setBandName(createEmptyBandForm(), "Big Night Band");
    expect(named.code).toBe("BNB");
    expect(named.codeTouched).toBe(false);

    const edited = setBandCode(named, "BIG");
    expect(setBandName(edited, "Big Night Orchestra").code).toBe("BIG");
  });

  it("bandFormFromBand treats the stored code and BACK VOCS as manual and reads bandLeaderId", () => {
    const state = bandFormFromBand(BAND_FILE, null);

    expect(state.codeTouched).toBe(true);
    expect(setBandName(state, "Big Night Orchestra").code).toBe("BNB");
    expect(state.bandLeaderId).toBe("krecmer_matej");
    expect(state.lineup).toEqual({
      drums: ["plasil_pavel"],
      bass: ["krecmer_matej"],
      guitar: [],
      keys: [],
      vocs: ["krecmerova_eliska"],
    });
    expect(state.backVocalIds).toEqual(["plasil_pavel"]);
    expect(state.backVocalsTouched).toBe(true);
  });

  it("bandFormFromBand loads the stored contact or starts without one", () => {
    expect(
      bandFormFromBand(BAND_FILE, {
        id: "krecmer_matej",
        firstName: "Matěj",
        lastName: "Krečmer",
        phone: "+420",
        email: "m@example.com",
      }).contact,
    ).toEqual({
      mode: "member",
      musicianId: "krecmer_matej",
      phone: "+420",
      email: "m@example.com",
    });
    expect(
      bandFormFromBand({ ...BAND_FILE, defaultContactId: undefined }, null)
        .contact,
    ).toEqual({
      mode: "none",
    });
  });

  it("ignores musicians who are already in the lineup", () => {
    const state = addMembersToGroup(
      withLineup(),
      "drums",
      ["plasil_pavel", "krecmer_matej", "nyvlt_jakub", "nyvlt_jakub"],
      canSing,
    );

    expect(state.lineup.drums).toEqual(["plasil_pavel", "nyvlt_jakub"]);
    expect(state.lineup.bass).toEqual(["krecmer_matej"]);
  });

  it("prefills BACK VOCS of a new band with the singers outside vocs, in lineup order", () => {
    const state = withLineup();

    expect(state.backVocalIds).toEqual(["plasil_pavel", "krecmer_matej"]);
    expect(state.backVocalsTouched).toBe(false);
  });

  it("re-derives BACK VOCS on every lineup change until the user edits them", () => {
    const state = addMembersToGroup(
      withLineup(),
      "drums",
      ["ernst_filip"],
      canSing,
    );

    expect(state.backVocalIds).toEqual([
      "plasil_pavel",
      "ernst_filip",
      "krecmer_matej",
    ]);
  });

  it("stops deriving BACK VOCS after a manual change", () => {
    const edited = removeBackVocal(withLineup(), "plasil_pavel");
    expect(edited.backVocalsTouched).toBe(true);

    const state = addMembersToGroup(edited, "drums", ["nyvlt_jakub"], canSing);

    expect(state.backVocalIds).toEqual(["krecmer_matej"]);
  });

  it("an existing band keeps its stored BACK VOCS when the lineup changes", () => {
    const state = addMembersToGroup(
      bandFormFromBand(BAND_FILE, null),
      "drums",
      ["nyvlt_jakub"],
      canSing,
    );

    expect(state.backVocalIds).toEqual(["plasil_pavel"]);
  });

  it("backVocalCandidates offers instrumentalists outside BACK VOCS, singing or not, never lead vocals", () => {
    const state = silentDrummerAndSinger();

    expect(state.backVocalIds).toEqual([]);
    expect(backVocalCandidates(state)).toEqual(["nyvlt_jakub"]);
  });

  it("addBackVocals adds only candidates and marks BACK VOCS as edited", () => {
    const state = addBackVocals(silentDrummerAndSinger(), [
      "nyvlt_jakub",
      "krecmerova_eliska",
      "ghost",
    ]);

    expect(state.backVocalIds).toEqual(["nyvlt_jakub"]);
    expect(state.backVocalsTouched).toBe(true);
    expect(backVocalCandidates(state)).toEqual([]);
  });

  it("removeMember clears the member from the lineup, the leader and BACK VOCS", () => {
    const state = removeMember(
      setBandLeader(withLineup(), "plasil_pavel"),
      "plasil_pavel",
    );

    expect(state.lineup.drums).toEqual([]);
    expect(state.bandLeaderId).toBe("");
    expect(state.backVocalIds).toEqual(["krecmer_matej"]);
  });

  it("removeMember drops the member from BACK VOCS even after a manual change", () => {
    const state = removeMember(
      removeBackVocal(withLineup(), "plasil_pavel"),
      "krecmer_matej",
    );

    expect(state.backVocalIds).toEqual([]);
  });

  it("removeMember of the contact keeps phone and e-mail but clears the member", () => {
    let state = setContactMember(withLineup(), "krecmer_matej", null);
    state = setContactField(state, "phone", "+420731247870");
    state = removeMember(state, "krecmer_matej");

    expect(state.contact).toEqual({
      mode: "member",
      musicianId: "",
      phone: "+420731247870",
      email: "",
    });
  });

  it("defaultContactMemberId prefers the leader, then the first member", () => {
    expect(defaultContactMemberId(createEmptyBandForm())).toBe("");
    expect(defaultContactMemberId(withLineup())).toBe("plasil_pavel");
    expect(
      defaultContactMemberId(setBandLeader(withLineup(), "krecmer_matej")),
    ).toBe("krecmer_matej");
  });

  it("setContactMember pre-fills from the stored contact and blanks without one", () => {
    const filled = setContactMember(withLineup(), "krecmer_matej", {
      id: "krecmer_matej",
      firstName: "Matěj",
      lastName: "Krečmer",
      email: "m@example.com",
    });

    expect(filled.contact).toEqual({
      mode: "member",
      musicianId: "krecmer_matej",
      phone: "",
      email: "m@example.com",
    });
    expect(setContactMember(filled, "plasil_pavel", null).contact).toEqual({
      mode: "member",
      musicianId: "plasil_pavel",
      phone: "",
      email: "",
    });
  });

  it("setContactField does nothing without a contact; disableContact switches it off", () => {
    const none = createEmptyBandForm();

    expect(setContactField(none, "phone", "1")).toBe(none);
    expect(
      disableContact(setContactMember(withLineup(), "krecmer_matej", null))
        .contact,
    ).toEqual({
      mode: "none",
    });
  });

  it("toBandDraft maps the state and omits a switched-off contact", () => {
    const state = setBandLeader(
      setBandName(withLineup(), "Duo"),
      "krecmer_matej",
    );

    expect(toBandDraft(state, null)).toEqual({
      name: "Duo",
      code: "DUO",
      bandLeaderId: "krecmer_matej",
      lineup: state.lineup,
      backVocalIds: ["plasil_pavel", "krecmer_matej"],
    });
    expect(toBandDraft(state, "duo")).toMatchObject({ existingId: "duo" });
  });

  it("a draft with a removed contact fails in the domain instead of writing it", () => {
    let state = setBandLeader(setBandName(withLineup(), "Duo"), "plasil_pavel");
    state = setContactField(
      setContactMember(state, "krecmer_matej", null),
      "phone",
      "+420731247870",
    );
    state = removeMember(state, "krecmer_matej");

    const result = buildBandFromDraft(
      toBandDraft(state, null),
      buildBandDraftContext({ musicians: MUSICIANS, presets: [], bands: [] }),
    );

    expect(result.ok ? [] : result.errors.map((error) => error.field)).toEqual([
      "contact",
    ]);
  });

  it("an unchanged existing band rebuilds its stored overlays", () => {
    const stored: Band = { ...BAND_FILE, defaultContactId: undefined };

    const result = buildBandFromDraft(
      toBandDraft(bandFormFromBand(stored, null), stored.id),
      buildBandDraftContext({
        musicians: MUSICIANS,
        presets: [],
        bands: [],
        existingBand: stored,
      }),
    );

    expect(result.ok ? result.band.defaultOverlays : result.errors).toEqual(
      BAND_FILE.defaultOverlays,
    );
  });

  it("availableMusiciansForGroup offers the group's musicians outside the lineup, by name", () => {
    const state = withLineup();

    expect(
      availableMusiciansForGroup(MUSICIANS, "drums", state).map(
        (item) => item.id,
      ),
    ).toEqual(["ernst_filip", "nyvlt_jakub"]);
    expect(availableMusiciansForGroup(MUSICIANS, "bass", state)).toEqual([]);
  });
});
