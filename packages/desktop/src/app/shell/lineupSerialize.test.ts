import { describe, expect, it } from "vitest";
import { serializeLineupForProject } from "./lineupSerialize";

describe("serializeLineupForProject", () => {
  it("keeps explicit empty back_vocs in serialized lineup", () => {
    const serialized = serializeLineupForProject(
      {
        vocs: "lead-1",
        back_vocs: [],
      },
      ["vocs"],
    );

    expect(serialized).toHaveProperty("back_vocs");
    expect(serialized.back_vocs).toEqual([]);
  });

  it("omits back_vocs when no explicit selection was provided", () => {
    const serialized = serializeLineupForProject(
      {
        vocs: "lead-1",
      },
      ["vocs"],
    );

    expect(serialized).not.toHaveProperty("back_vocs");
  });
});
