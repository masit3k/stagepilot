import { describe, expect, it } from "vitest";
import { ensureMusiciansInLineup } from "./ensureMusiciansInLineup";

describe("ensureMusiciansInLineup", () => {
  it("adds catalog-only vocs musicians to the vocs lineup", () => {
    const lineup = ensureMusiciansInLineup(
      { vocs: ["holoubek_lukas"] },
      new Map([
        ["mimrova_zuzana", { group: "vocs" }],
      ]),
      ["mimrova_zuzana"],
    );

    expect(lineup.vocs).toEqual([
      { musicianId: "holoubek_lukas" },
      { musicianId: "mimrova_zuzana" },
    ]);
  });

  it("does not add an existing bass player to vocs when selected as lead", () => {
    const lineup = ensureMusiciansInLineup(
      { bass: ["krecmer_matej"], vocs: [] },
      new Map([
        ["krecmer_matej", { group: "vocs" }],
      ]),
      ["krecmer_matej"],
    );

    expect(lineup.bass).toEqual(["krecmer_matej"]);
    expect(lineup.vocs).toEqual([]);
  });

  it("adds catalog-only instrumentalists to their primary group", () => {
    const lineup = ensureMusiciansInLineup(
      { guitar: ["pisa_karel"] },
      new Map([
        ["guitar_guest", { group: "guitar" }],
      ]),
      ["guitar_guest", "guitar_guest"],
    );

    expect(lineup.guitar).toEqual([
      { musicianId: "pisa_karel" },
      { musicianId: "guitar_guest" },
    ]);
  });
});
