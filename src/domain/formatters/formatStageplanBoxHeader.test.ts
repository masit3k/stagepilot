import { describe, expect, it } from "vitest";
import type { Band } from "../model/types.js";
import { formatStageplanBoxHeader } from "./formatStageplanBoxHeader.js";

describe("formatStageplanBoxHeader", () => {
  const band: Band = {
    id: "band-1",
    name: "Band",
    bandLeader: "leader-id",
    defaultLineup: {},
  };

  it("adds suffix for band leader", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Guitar",
      musicianName: "Leader Name",
      musicianId: "leader-id",
      band,
    });

    expect(label).toBe("Guitar – Leader Name (band leader)");
  });

  it("does not add suffix for other musicians", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Keys",
      musicianName: "Other Name",
      musicianId: "other-id",
      band,
    });

    expect(label).toBe("Keys – Other Name");
  });
});
