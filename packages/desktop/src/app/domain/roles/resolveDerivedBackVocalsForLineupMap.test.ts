import { describe, expect, it } from "vitest";
import type { PresetEntity } from "../../../../../../src/domain/model/types";
import { resolveDerivedBackVocalsForLineupMap } from "./resolveDerivedBackVocalsForLineupMap";

const PRESETS: Record<string, PresetEntity> = {
  vocal_wireless: {
    type: "preset",
    id: "vocal_wireless",
    label: "Vocal (wireless)",
    group: "vocs",
    capabilities: ["vocal"],
    inputs: [{ key: "voc_input", label: "Vocal" }],
  },
  el_bass_xlr_amp: {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Electric bass guitar",
    group: "bass",
    inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar" }],
  },
} as unknown as Record<string, PresetEntity>;

/** Kdo nese preset s `capabilities: ["vocal"]`, ten zpívá. */
const MUSICIAN_PRESETS = {
  plasil_pavel: [{ kind: "preset", ref: "vocal_wireless" }],
  krecmer_matej: [
    { kind: "preset", ref: "el_bass_xlr_amp" },
    { kind: "preset", ref: "vocal_wireless" },
  ],
  pisa_karel: [{ kind: "preset", ref: "el_bass_xlr_amp" }],
  zidek_jakub: [{ kind: "preset", ref: "vocal_wireless" }],
  krecmerova_eliska: [{ kind: "preset", ref: "vocal_wireless" }],
  skalicka_vit: [{ kind: "preset", ref: "el_bass_xlr_amp" }],
};

const USER_LINEUP = {
  drums: [{ musicianId: "plasil_pavel" }],
  bass: [{ musicianId: "krecmer_matej" }],
  guitar: [{ musicianId: "pisa_karel" }],
  keys: [{ musicianId: "zidek_jakub" }],
  vocs: [{ musicianId: "krecmerova_eliska" }],
};

function derive(args: {
  lineup?: Record<string, unknown>;
  leadVocalIds?: string[];
  backVocalIds?: string[];
}) {
  return resolveDerivedBackVocalsForLineupMap({
    lineup: (args.lineup ?? USER_LINEUP) as never,
    musicianPresetsById: MUSICIAN_PRESETS as never,
    presetCatalog: PRESETS,
    leadVocalIds: args.leadVocalIds ?? ["krecmerova_eliska"],
    backVocalIds: args.backVocalIds ?? [],
  });
}

describe("resolveDerivedBackVocalsForLineupMap", () => {
  it("collects every singing lineup member except the lead vocalist", () => {
    expect(derive({}).backVocalIds).toEqual([
      "plasil_pavel",
      "krecmer_matej",
      "zidek_jakub",
    ]);
  });

  it("skips a non-singing replacement and drops the singer who left", () => {
    expect(
      derive({
        lineup: { ...USER_LINEUP, drums: [{ musicianId: "skalicka_vit" }] },
        backVocalIds: ["plasil_pavel", "krecmer_matej", "zidek_jakub"],
      }).backVocalIds,
    ).toEqual(["krecmer_matej", "zidek_jakub"]);
  });

  it("is idempotent — the derived set feeds back unchanged", () => {
    const first = derive({});
    const second = derive({ backVocalIds: [...first.backVocalIds] });

    expect(second.backVocalIds).toEqual(first.backVocalIds);
    expect(second.didChange).toBe(false);
  });

  it("reports a change when the stored set is stale", () => {
    expect(derive({ backVocalIds: ["plasil_pavel"] }).didChange).toBe(true);
  });

  it("orders back vocals by ROLE_ORDER so the same lineup always serializes alike", () => {
    // Stejný lineup zapsaný s rolemi v jiném pořadí musí dát totéž pole,
    // jinak by se projekt měnil při každém otevření.
    const reordered = {
      vocs: USER_LINEUP.vocs,
      keys: USER_LINEUP.keys,
      guitar: USER_LINEUP.guitar,
      bass: USER_LINEUP.bass,
      drums: USER_LINEUP.drums,
    };

    expect(derive({ lineup: reordered }).backVocalIds).toEqual(
      derive({}).backVocalIds,
    );
  });

  it("returns nothing for an empty lineup", () => {
    expect(derive({ lineup: {}, leadVocalIds: [] }).backVocalIds).toEqual([]);
  });
});
