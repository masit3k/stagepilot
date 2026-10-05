import { describe, expect, it } from "vitest";
import { deriveVocalOverlaysFromLineup } from "./deriveVocalOverlaysFromLineup.js";

/** Ověřeno proti katalogu presetů: kdo nese preset s `capabilities: ["vocal"]`. */
const SINGERS = new Set([
  "krecmer_matej",
  "ernst_filip",
  "plasil_pavel",
  "cetel_tomas",
  "mludek_tomas",
  "zidek_jakub",
  "holoubek_lukas",
  "krecmerova_eliska",
  "mimrova_zuzana",
  "starkova_danka",
]);

const canSing = (musicianId: string): boolean => SINGERS.has(musicianId);

describe("deriveVocalOverlaysFromLineup", () => {
  it("puts every singing lineup member into back vocals", () => {
    const result = deriveVocalOverlaysFromLineup({
      lineupMusicianIds: [
        "plasil_pavel",
        "krecmer_matej",
        "pisa_karel",
        "zidek_jakub",
        "krecmerova_eliska",
      ],
      leadVocalIds: ["krecmerova_eliska"],
      canSing,
    });

    expect(result.backVocalIds).toEqual([
      "plasil_pavel",
      "krecmer_matej",
      "zidek_jakub",
    ]);
    expect(result.leadVocalIds).toEqual(["krecmerova_eliska"]);
  });

  it("drops a musician who left the lineup and skips the non-singing replacement", () => {
    const result = deriveVocalOverlaysFromLineup({
      lineupMusicianIds: [
        "skalicka_vit",
        "krecmer_matej",
        "pisa_karel",
        "zidek_jakub",
        "krecmerova_eliska",
      ],
      leadVocalIds: ["krecmerova_eliska"],
      canSing,
    });

    expect(result.backVocalIds).toEqual(["krecmer_matej", "zidek_jakub"]);
  });

  it("never lists a lead vocalist among the back vocals", () => {
    const result = deriveVocalOverlaysFromLineup({
      lineupMusicianIds: ["krecmer_matej", "cetel_tomas", "mludek_tomas"],
      leadVocalIds: ["cetel_tomas"],
      canSing,
    });

    expect(result.backVocalIds).toEqual(["krecmer_matej", "mludek_tomas"]);
  });

  it("is idempotent — a second pass over derived overlays changes nothing", () => {
    const lineupMusicianIds = [
      "plasil_pavel",
      "krecmer_matej",
      "pisa_karel",
      "zidek_jakub",
      "krecmerova_eliska",
    ];
    const first = deriveVocalOverlaysFromLineup({
      lineupMusicianIds,
      leadVocalIds: ["krecmerova_eliska"],
      canSing,
    });
    const second = deriveVocalOverlaysFromLineup({
      lineupMusicianIds,
      leadVocalIds: first.leadVocalIds,
      backVocalIds: first.backVocalIds,
      canSing,
    });

    expect(second.backVocalIds).toEqual(first.backVocalIds);
    expect(second.leadVocalIds).toEqual(first.leadVocalIds);
    expect(second.didChange).toBe(false);
  });

  it("reports didChange when the previous back vocals differ from the derived set", () => {
    const result = deriveVocalOverlaysFromLineup({
      lineupMusicianIds: ["krecmer_matej", "cetel_tomas"],
      leadVocalIds: [],
      backVocalIds: ["krecmer_matej"],
      canSing,
    });

    expect(result.backVocalIds).toEqual(["krecmer_matej", "cetel_tomas"]);
    expect(result.didChange).toBe(true);
  });

  it("keeps the lineup order, not the order of the previous selection", () => {
    const result = deriveVocalOverlaysFromLineup({
      lineupMusicianIds: ["plasil_pavel", "krecmer_matej", "cetel_tomas"],
      leadVocalIds: [],
      backVocalIds: ["cetel_tomas", "krecmer_matej", "plasil_pavel"],
      canSing,
    });

    expect(result.backVocalIds).toEqual([
      "plasil_pavel",
      "krecmer_matej",
      "cetel_tomas",
    ]);
  });

  it("drops a lead vocalist who is no longer in the lineup", () => {
    const result = deriveVocalOverlaysFromLineup({
      lineupMusicianIds: ["krecmer_matej", "cetel_tomas"],
      leadVocalIds: ["mimrova_zuzana"],
      canSing,
    });

    expect(result.leadVocalIds).toEqual([]);
    expect(result.backVocalIds).toEqual(["krecmer_matej", "cetel_tomas"]);
  });

  it("ignores blank and duplicated lineup entries", () => {
    const result = deriveVocalOverlaysFromLineup({
      lineupMusicianIds: ["", "krecmer_matej", " ", "krecmer_matej"],
      leadVocalIds: [],
      canSing,
    });

    expect(result.backVocalIds).toEqual(["krecmer_matej"]);
  });
});
