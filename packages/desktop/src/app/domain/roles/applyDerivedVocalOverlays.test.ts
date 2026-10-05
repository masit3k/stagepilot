import { describe, expect, it } from "vitest";
import type {
  Musician,
  PresetEntity,
  PresetItem,
} from "../../../../../../src/domain/model/types";
import { applyDerivedVocalOverlays } from "./applyDerivedVocalOverlays";

const VOCAL_PRESET: PresetEntity = {
  id: "vocal_wired",
  type: "preset",
  name: "Vocal (wired)",
  capabilities: ["vocal"],
  inputs: [{ key: "voc", label: "Vocal", group: "vocs" }],
  monitoring: { monitorRef: "wedge_foh" },
} as PresetEntity;

const BASS_PRESET: PresetEntity = {
  id: "bass_di",
  type: "preset",
  name: "Bass DI",
  inputs: [{ key: "bass", label: "Bass", group: "bass" }],
  monitoring: { monitorRef: "wedge_foh" },
} as PresetEntity;

const PRESET_CATALOG: Record<string, PresetEntity> = {
  vocal_wired: VOCAL_PRESET,
  bass_di: BASS_PRESET,
};

/** Ověřeno proti katalogu: tihle nesou preset s `capabilities: ["vocal"]`. */
const SINGER_IDS = [
  "plasil_pavel",
  "krecmer_matej",
  "zidek_jakub",
  "cetel_tomas",
  "krecmerova_eliska",
];
const NON_SINGER_IDS = ["pisa_karel", "skalicka_vit", "plasil_jan"];

function musician(id: string): Musician {
  const presets: PresetItem[] = [
    {
      kind: "preset",
      ref: SINGER_IDS.includes(id) ? "vocal_wired" : "bass_di",
    } as PresetItem,
  ];
  return {
    id,
    firstName: "",
    lastName: "",
    group: "bass",
    presets,
  } as Musician;
}

function apply(args: {
  lineupIds: string[];
  leadVocalIds: string[];
  backVocalIds?: string[];
}) {
  return applyDerivedVocalOverlays({
    lineupMusicians: args.lineupIds.map(musician),
    leadVocalIds: args.leadVocalIds,
    backVocalIds: args.backVocalIds ?? [],
    presetCatalog: PRESET_CATALOG,
  });
}

describe("applyDerivedVocalOverlays", () => {
  it("derives back vocals from the vocal capability of every lineup member", () => {
    expect(
      apply({
        lineupIds: [
          "plasil_pavel",
          "krecmer_matej",
          "pisa_karel",
          "zidek_jakub",
          "krecmerova_eliska",
        ],
        leadVocalIds: ["krecmerova_eliska"],
      }),
    ).toEqual({
      leadVocalIds: ["krecmerova_eliska"],
      backVocalIds: ["plasil_pavel", "krecmer_matej", "zidek_jakub"],
      didChange: true,
    });
  });

  it("drops a singer who left and does not add the non-singing replacement", () => {
    expect(
      apply({
        lineupIds: ["skalicka_vit", "krecmer_matej", "zidek_jakub"],
        leadVocalIds: [],
        backVocalIds: ["plasil_pavel", "krecmer_matej", "zidek_jakub"],
      }).backVocalIds,
    ).toEqual(["krecmer_matej", "zidek_jakub"]);
  });

  it("never lists a lead vocalist among the back vocals", () => {
    expect(
      apply({
        lineupIds: ["krecmer_matej", "cetel_tomas"],
        leadVocalIds: ["cetel_tomas"],
      }).backVocalIds,
    ).toEqual(["krecmer_matej"]);
  });

  it("reports no change once the overlays already match the lineup", () => {
    const first = apply({
      lineupIds: ["plasil_pavel", "krecmer_matej", "krecmerova_eliska"],
      leadVocalIds: ["krecmerova_eliska"],
    });

    expect(
      apply({
        lineupIds: ["plasil_pavel", "krecmer_matej", "krecmerova_eliska"],
        leadVocalIds: [...first.leadVocalIds],
        backVocalIds: [...first.backVocalIds],
      }),
    ).toEqual({ ...first, didChange: false });
  });

  it("treats a musician without any vocal preset as a non-singer", () => {
    expect(
      apply({ lineupIds: NON_SINGER_IDS, leadVocalIds: [] }).backVocalIds,
    ).toEqual([]);
  });
});
