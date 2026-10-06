import { describe, expect, it } from "vitest";
import type { Band, Musician, PresetEntity } from "../model/types";
import { buildBandDraftContext } from "./buildBandDraftContext";
import { buildBandFromDraft } from "./buildBandFromDraft";

const BANDS = [
  { id: "big_night_band", code: "BNB" },
  { id: "blanicka_kapela", code: "BK" },
];

const EXISTING_BNB: Band = {
  type: "band",
  id: "big_night_band",
  code: "BNB",
  name: "Big Night Band",
  bandLeader: "",
  defaultLineup: {},
};

const VOCAL_WIRED: PresetEntity = {
  type: "preset",
  id: "vocal_wired",
  label: "Vocal (wired)",
  group: "vocs",
  capabilities: ["vocal"],
  inputs: [{ key: "voc_input", label: "Vocal" }],
};

const BASS_DI: PresetEntity = {
  type: "preset",
  id: "el_bass_di",
  label: "Bass DI",
  group: "bass",
  inputs: [{ key: "el_bass_di", label: "Bass" }],
};

const SINGER: Musician = {
  id: "singer",
  firstName: "Anna",
  lastName: "Zpěvačka",
  group: "vocs",
  presets: [{ kind: "preset", ref: "vocal_wired" }],
};

const BASSIST: Musician = {
  id: "bassist",
  firstName: "Petr",
  lastName: "Basák",
  group: "bass",
  presets: [{ kind: "preset", ref: "el_bass_di" }],
};

describe("buildBandDraftContext", () => {
  it("excludes the edited band from id and code collisions", () => {
    const context = buildBandDraftContext({
      musicians: [],
      presets: [],
      bands: BANDS,
      existingBand: EXISTING_BNB,
    });

    expect([...context.existingBandIds]).toEqual(["blanicka_kapela"]);
    expect([...context.existingCodes]).toEqual(["bk"]);
    expect(context.existingBand).toBe(EXISTING_BNB);
  });

  it("lowercases codes and skips bands without one", () => {
    const context = buildBandDraftContext({
      musicians: [],
      presets: [],
      bands: [
        { id: "a_band", code: " XY " },
        { id: "b_band", code: null },
      ],
    });

    expect([...context.existingBandIds]).toEqual(["a_band", "b_band"]);
    expect([...context.existingCodes]).toEqual(["xy"]);
  });

  it("answers canSing from the vocal capability in the preset catalog", () => {
    const context = buildBandDraftContext({
      musicians: [SINGER, BASSIST],
      presets: [VOCAL_WIRED, BASS_DI],
      bands: [],
    });

    expect(context.canSing("singer")).toBe(true);
    expect(context.canSing("bassist")).toBe(false);
    expect(context.canSing("nobody")).toBe(false);
    expect(context.musiciansById.singer).toBe(SINGER);
  });

  it("carries reserved ids in lower case", () => {
    const context = buildBandDraftContext({
      musicians: [],
      presets: [],
      bands: [],
      reservedIds: ["New"],
    });

    expect(context.reservedIds?.has("new")).toBe(true);
  });

  it("lets the domain reject a new band that reuses an existing code", () => {
    const context = buildBandDraftContext({
      musicians: [],
      presets: [],
      bands: BANDS,
    });

    const result = buildBandFromDraft(
      {
        name: "Big Night Orchestra",
        code: "bnb",
        lineup: {},
        leadVocalIds: [],
      },
      context,
    );

    expect(result.ok ? [] : result.errors.map((error) => error.field)).toEqual([
      "code",
    ]);
  });
});
