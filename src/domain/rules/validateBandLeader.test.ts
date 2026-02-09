import { describe, expect, it } from "vitest";
import type { Band, Musician } from "../model/types.js";
import type { DataRepository } from "../../infra/fs/repo.js";
import { validateBandLeader } from "./validateBandLeader.js";

const baseBand: Band = {
  id: "test-band",
  name: "Test Band",
  bandLeader: "leader-id",
  defaultLineup: {},
};

const makeRepo = (musicians: Record<string, Musician>): DataRepository =>
  ({
    getMusician: (id: string) => {
      const musician = musicians[id];
      if (!musician) {
        throw new Error(`Musician not found: ${id}`);
      }
      return musician;
    },
  }) as DataRepository;

describe("validateBandLeader", () => {
  it("accepts bandLeader that exists in musicians", () => {
    const repo = makeRepo({
      "leader-id": {
        id: "leader-id",
        firstName: "Leader",
        lastName: "Person",
        group: "bass",
        presets: [],
      },
    });

    expect(() => validateBandLeader(baseBand, repo)).not.toThrow();
  });

  it("throws when bandLeader is missing", () => {
    const repo = makeRepo({});
    const band = { ...baseBand, bandLeader: "" };

    expect(() => validateBandLeader(band, repo)).toThrow(
      "Band 'test-band' must define bandLeader referencing an existing musician id."
    );
  });

  it("throws when bandLeader does not exist in musicians", () => {
    const repo = makeRepo({});

    expect(() => validateBandLeader(baseBand, repo)).toThrow(
      "Band 'test-band' must define bandLeader referencing an existing musician id."
    );
  });
});
