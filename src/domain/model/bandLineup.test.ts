import { describe, expect, it } from "vitest";
import {
  getAllLineupMemberIds,
  getLineupMembersByGroup,
  validateCanonicalBandModel,
} from "./bandLineup";
import type { Band } from "./types";

function createBand(overrides?: Partial<Band>): Band {
  return {
    id: "band-1",
    name: "Band",
    bandLeader: "dr-1",
    defaultContactId: "dr-1",
    defaultLineup: {
      drums: ["dr-1"],
      bass: ["b-1"],
      guitar: ["g-1"],
      keys: ["k-1"],
      vocs: ["v-1"],
    },
    defaultVocals: {
      lead: ["v-1"],
      back: ["k-1"],
    },
    ...overrides,
  };
}

describe("band lineup canonical model", () => {
  it("accepts canonical array-based lineup and default vocals", () => {
    expect(() => validateCanonicalBandModel(createBand())).not.toThrow();
  });

  it("fails when lineup group is not an array", () => {
    const invalid = createBand({
      defaultLineup: { drums: "dr-1" as unknown as string[], bass: ["b-1"] },
    });
    expect(() => validateCanonicalBandModel(invalid)).toThrow(
      "defaultLineup.drums must be an array",
    );
  });

  it("fails when vocalist assignment points outside lineup", () => {
    const invalid = createBand({
      defaultVocals: { lead: ["missing-id"], back: [] },
    });
    expect(() => validateCanonicalBandModel(invalid)).toThrow(
      "defaultVocals.lead contains 'missing-id' not present in defaultLineup.",
    );
  });

  it("fails when one musician appears in multiple lineup groups", () => {
    const invalid = createBand({
      defaultLineup: {
        drums: ["shared-id"],
        bass: ["shared-id"],
      },
      defaultVocals: { lead: ["shared-id"], back: [] },
    });
    expect(() => validateCanonicalBandModel(invalid)).toThrow(
      "assigned to multiple lineup groups",
    );
  });

  it("fails when one musician appears in both lead and back vocals", () => {
    const invalid = createBand({
      defaultVocals: { lead: ["v-1"], back: ["v-1"] },
    });
    expect(() => validateCanonicalBandModel(invalid)).toThrow(
      "cannot be in both",
    );
  });
});

describe("getAllLineupMemberIds", () => {
  it("returns ordered union across all lineup groups including vocs", () => {
    const ids = getAllLineupMemberIds({
      drums: ["dr-1"],
      bass: ["shared", "b-2"],
      guitar: ["g-1"],
      keys: ["shared", "k-2"],
      vocs: ["v-1"],
    });
    expect(ids).toEqual(["dr-1", "shared", "b-2", "g-1", "k-2", "v-1"]);
  });

  it("returns deterministic grouped membership", () => {
    const grouped = getLineupMembersByGroup({
      drums: ["dr-1"],
      bass: ["b-1"],
    });
    expect(grouped.drums).toEqual(["dr-1"]);
    expect(grouped.bass).toEqual(["b-1"]);
    expect(grouped.guitar).toEqual([]);
    expect(grouped.vocs).toEqual([]);
  });
});

