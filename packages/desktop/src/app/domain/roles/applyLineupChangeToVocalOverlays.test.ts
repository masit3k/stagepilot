import { describe, expect, it } from "vitest";
import { applyLineupChangeToVocalOverlays } from "./applyLineupChangeToVocalOverlays";

const SINGERS = new Set([
  "krecmer_matej",
  "ernst_filip",
  "plasil_pavel",
  "cetel_tomas",
  "mludek_tomas",
]);

const canSing = (musicianId: string): boolean => SINGERS.has(musicianId);

describe("applyLineupChangeToVocalOverlays", () => {
  it("moves a singing replacement onto the position the outgoing member held", () => {
    expect(
      applyLineupChangeToVocalOverlays({
        leadVocalIds: [],
        backVocalIds: ["krecmer_matej", "plasil_pavel"],
        slotChanges: [
          { previousMusicianId: "plasil_pavel", nextMusicianId: "cetel_tomas" },
        ],
        canSing,
      }),
    ).toEqual({
      leadVocalIds: [],
      backVocalIds: ["krecmer_matej", "cetel_tomas"],
      didChange: true,
    });
  });

  it("drops the outgoing member when the replacement cannot sing", () => {
    expect(
      applyLineupChangeToVocalOverlays({
        leadVocalIds: [],
        backVocalIds: ["plasil_pavel", "cetel_tomas"],
        slotChanges: [
          { previousMusicianId: "cetel_tomas", nextMusicianId: "pisa_karel" },
        ],
        canSing,
      }),
    ).toEqual({
      leadVocalIds: [],
      backVocalIds: ["plasil_pavel"],
      didChange: true,
    });
  });

  it("lets the invariant win when the replacement already sings lead", () => {
    expect(
      applyLineupChangeToVocalOverlays({
        leadVocalIds: ["ernst_filip"],
        backVocalIds: ["plasil_pavel"],
        slotChanges: [
          { previousMusicianId: "plasil_pavel", nextMusicianId: "ernst_filip" },
        ],
        canSing,
      }),
    ).toEqual({
      leadVocalIds: ["ernst_filip"],
      backVocalIds: [],
      didChange: true,
    });
  });

  it("reports no change when the lineup change touches nobody with an overlay", () => {
    expect(
      applyLineupChangeToVocalOverlays({
        leadVocalIds: ["krecmer_matej"],
        backVocalIds: ["cetel_tomas"],
        slotChanges: [
          { previousMusicianId: "plasil_jan", nextMusicianId: "mludek_tomas" },
        ],
        canSing,
      }),
    ).toEqual({
      leadVocalIds: ["krecmer_matej"],
      backVocalIds: ["cetel_tomas"],
      didChange: false,
    });
  });

  it("reconciles lead and back in a single multi-slot commit", () => {
    expect(
      applyLineupChangeToVocalOverlays({
        leadVocalIds: ["plasil_pavel"],
        backVocalIds: ["cetel_tomas", "krecmer_matej"],
        slotChanges: [
          { previousMusicianId: "plasil_pavel", nextMusicianId: "ernst_filip" },
          { previousMusicianId: "cetel_tomas", nextMusicianId: "skalicka_vit" },
        ],
        canSing,
      }),
    ).toEqual({
      leadVocalIds: ["ernst_filip"],
      backVocalIds: ["krecmer_matej"],
      didChange: true,
    });
  });
});
