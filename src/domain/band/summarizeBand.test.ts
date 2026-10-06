import { describe, expect, it } from "vitest";
import { summarizeBand } from "./summarizeBand";

describe("summarizeBand", () => {
  it("counts members of a real band file that carries only bandLeaderId", () => {
    expect(
      summarizeBand({
        bandLeaderId: "krecmer_matej",
        defaultLineup: {
          drums: ["plasil_pavel"],
          bass: ["krecmer_matej"],
          guitar: ["pisa_karel"],
          keys: ["zidek_jakub"],
          vocs: ["krecmerova_eliska"],
        },
      }),
    ).toEqual({ memberCount: 5, isIncomplete: false });
  });

  it("marks a band without a lineup as incomplete", () => {
    expect(
      summarizeBand({ bandLeader: "", bandLeaderId: "", defaultLineup: {} }),
    ).toEqual({
      memberCount: 0,
      isIncomplete: true,
    });
  });

  it("marks a band with members but no leader as incomplete", () => {
    expect(
      summarizeBand({
        bandLeader: "",
        defaultLineup: { bass: ["krecmer_matej"] },
      }),
    ).toEqual({
      memberCount: 1,
      isIncomplete: true,
    });
  });
});
