import { describe, expect, it } from "vitest";
import {
  getAllLineupMemberIds,
  getLineupMembersByGroup,
  normalizeBandToCanonicalShape,
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
    defaultOverlays: {
      leadVocals: [{ slot: 1, musicianId: "v-1" }],
      backVocals: [{ slot: 1, musicianId: "k-1" }],
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
      defaultOverlays: {
        leadVocals: [{ slot: 1, musicianId: "missing-id" }],
        backVocals: [],
      },
    });
    expect(() => validateCanonicalBandModel(invalid)).toThrow(
      "defaultOverlays.leadVocals contains 'missing-id' not present in defaultLineup.",
    );
  });

  it("fails when one musician appears in multiple lineup groups", () => {
    const invalid = createBand({
      defaultLineup: {
        drums: ["shared-id"],
        bass: ["shared-id"],
      },
      defaultOverlays: {
        leadVocals: [{ slot: 1, musicianId: "shared-id" }],
        backVocals: [],
      },
    });
    expect(() => validateCanonicalBandModel(invalid)).toThrow(
      "assigned to multiple lineup groups",
    );
  });

  it("fails when one musician appears in both lead and back vocals", () => {
    const invalid = createBand({
      defaultOverlays: {
        leadVocals: [{ slot: 1, musicianId: "v-1" }],
        backVocals: [{ slot: 1, musicianId: "v-1" }],
      },
    });
    expect(() => validateCanonicalBandModel(invalid)).toThrow(
      "cannot be in both",
    );
  });

  it("normalizes legacy string overlay arrays and talkback fallback", () => {
    const normalized = normalizeBandToCanonicalShape(
      createBand({
        bandLeader: "",
        bandLeaderId: "dr-1",
        defaultTalkbackOwnerId: undefined,
        defaultOverlays: undefined,
        defaultVocals: {
          lead: ["v-1"],
          back: ["k-1"],
        },
      }),
    );

    expect(normalized.defaultOverlays).toEqual({
      leadVocals: [{ slot: 1, musicianId: "v-1" }],
      backVocals: [{ slot: 1, musicianId: "k-1" }],
    });
    expect(normalized.bandLeader).toBe("dr-1");
    expect(normalized.defaultTalkbackOwnerId).toBe("dr-1");
  });

  it("normalizes default lineup role values and removes same-role duplicates", () => {
    const normalized = normalizeBandToCanonicalShape(
      createBand({
        defaultLineup: {
          drums: ["dr-1", "dr-2", "dr-1"],
          bass: "b-1" as unknown as string[],
          guitar: null as unknown as string[],
        },
      }),
    );

    expect(normalized.defaultLineup).toEqual({
      drums: ["dr-1", "dr-2"],
      bass: ["b-1"],
      guitar: [],
      keys: [],
      vocs: [],
    });
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
