import { describe, expect, it } from "vitest";
import {
  addMusicianToRole,
  moveMusicianInRole,
  normalizeLineupAssignments,
  removeMusicianFromRole,
} from "./lineupAssignments.js";

describe("lineup assignment helpers", () => {
  it("normalizes scalar, null, missing, and duplicate role values", () => {
    expect(
      normalizeLineupAssignments({
        drums: ["plasil_pavel", "nyvlt_jakub", "plasil_pavel"],
        bass: "krecmer_matej",
        guitar: null,
      }),
    ).toEqual({
      drums: ["plasil_pavel", "nyvlt_jakub"],
      bass: ["krecmer_matej"],
      guitar: [],
      keys: [],
      vocs: [],
    });
  });

  it("preserves existing unique array order", () => {
    expect(
      normalizeLineupAssignments({
        guitar: ["gtr-2", "gtr-1", "gtr-3"],
      }).guitar,
    ).toEqual(["gtr-2", "gtr-1", "gtr-3"]);
  });

  it("appends a new musician and ignores duplicate adds", () => {
    const base = normalizeLineupAssignments({ drums: ["dr-1"] });
    const withNew = addMusicianToRole(base, "drums", "dr-2");

    expect(withNew.drums).toEqual(["dr-1", "dr-2"]);
    expect(addMusicianToRole(withNew, "drums", "dr-2")).toBe(withNew);
  });

  it("removes a musician from a role", () => {
    const base = normalizeLineupAssignments({ bass: ["b-1", "b-2"] });

    expect(removeMusicianFromRole(base, "bass", "b-1").bass).toEqual(["b-2"]);
  });

  it("moves musicians and treats invalid moves as no-ops", () => {
    const base = normalizeLineupAssignments({ keys: ["k-1", "k-2", "k-3"] });

    expect(moveMusicianInRole(base, "keys", 0, -1)).toBe(base);
    expect(moveMusicianInRole(base, "keys", 2, 3)).toBe(base);
    expect(moveMusicianInRole(base, "keys", 1, 0).keys).toEqual([
      "k-2",
      "k-1",
      "k-3",
    ]);
    expect(moveMusicianInRole(base, "keys", 1, 2).keys).toEqual([
      "k-1",
      "k-3",
      "k-2",
    ]);
  });
});
