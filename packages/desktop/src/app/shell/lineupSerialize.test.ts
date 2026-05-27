import { describe, expect, it } from "vitest";
import { serializeLineupForProject } from "./lineupSerialize";

describe("serializeLineupForProject", () => {
  it("serializes singleton instrument roles as arrays", () => {
    const serialized = serializeLineupForProject(
      {
        drums: "drummer-1",
        bass: "bass-1",
        guitar: "guitar-1",
        keys: "keys-1",
      },
      ["drums", "bass", "guitar", "keys"],
    );

    expect(serialized.drums).toEqual(["drummer-1"]);
    expect(serialized.bass).toEqual(["bass-1"]);
    expect(serialized.guitar).toEqual(["guitar-1"]);
    expect(serialized.keys).toEqual(["keys-1"]);
  });

  it("persists vocs role as vocs and not legacy lead_vocs", () => {
    const serialized = serializeLineupForProject(
      {
        vocs: ["lead-1"],
      },
      ["vocs"],
    );

    expect(serialized.vocs).toEqual(["lead-1"]);
    expect(serialized).not.toHaveProperty("lead_vocs");
  });

  it("drops legacy back_vocs from serialized lineup", () => {
    const serialized = serializeLineupForProject(
      {
        vocs: "lead-1",
        back_vocs: [],
      },
      ["vocs"],
    );

    expect(serialized).not.toHaveProperty("back_vocs");
  });

  it("serializes single-slot role overrides as array entries", () => {
    const serialized = serializeLineupForProject(
      {
        drums: {
          musicianId: "drummer-1",
          presetOverride: {
            monitoring: {
              monitorRef: "iem_mono_wired",
            },
          },
        },
      },
      ["drums"],
    );

    expect(serialized.drums).toEqual([
      {
        musicianId: "drummer-1",
        presetOverride: {
          monitoring: {
            monitorRef: "iem_mono_wired",
          },
        },
      },
    ]);
  });
});
