import { describe, expect, it } from "vitest";
import { createDefaultDrumDefinition } from "./drumDefinition.js";
import { resolveDrumDefinitionInputs } from "./resolveDrumDefinitionInputs.js";
import { validateDrumDefinition } from "./validateDrumDefinition.js";

describe("validateDrumDefinition", () => {
  it("rejects invalid kick/snare sources", () => {
    const definition = createDefaultDrumDefinition();
    definition.kicks = [{ in: false, out: false }];
    definition.snares = [{ top: false, bottom: false }];
    const errors = validateDrumDefinition(definition);
    expect(errors.some((item) => item.code === "kick_source")).toBe(true);
    expect(errors.some((item) => item.code === "snare_source")).toBe(true);
  });
});

describe("resolveDrumDefinitionInputs", () => {
  it("resolves deterministic keys with tracks", () => {
    const definition = createDefaultDrumDefinition();
    definition.tracks.enabled = true;
    const keys = resolveDrumDefinitionInputs(definition).map((item) => item.key);
    expect(keys).toContain("dr_tracks_l");
    expect(keys).toContain("dr_tracks_r");
    expect(keys[0]).toBe("dr_kick_1_out");
  });

  it("assigns stable semantic ids", () => {
    const definition = createDefaultDrumDefinition();
    const kickIn = resolveDrumDefinitionInputs(definition).find((item) => item.key === "dr_kick_1_in");
    expect(kickIn?.id).toBe("kick_1_in");
  });
});


describe("drum labels and notes", () => {
  it("uses target kick label + note", () => {
    const definition = createDefaultDrumDefinition();
    const kickOut = resolveDrumDefinitionInputs(definition).find((item) => item.key === "dr_kick_1_out");
    expect(kickOut?.label).toBe("Kick OUT");
    expect(kickOut?.note).toBe("Beta 52A / SE V Kick / e602 / D6 / D112 – kick mic stand");
  });

  it("uses stereo note for stereo pad and tracks", () => {
    const definition = createDefaultDrumDefinition();
    definition.pad = { enabled: true, mode: "sfx", channels: "stereo" };
    definition.tracks = { enabled: true };
    const resolved = resolveDrumDefinitionInputs(definition);
    const leftPad = resolved.find((item) => item.key === "dr_pad_stereo_sfx_l");
    const rightPad = resolved.find((item) => item.key === "dr_pad_stereo_sfx_r");
    const tracksL = resolved.find((item) => item.key === "dr_tracks_l");
    const tracksR = resolved.find((item) => item.key === "dr_tracks_r");

    expect(leftPad?.note).toBe("2x TS jack 6.3mm – DI box");
    expect(rightPad?.note).toBe("2x TS jack 6.3mm – DI box");
    expect(tracksL?.note).toBe("2x TS jack 6.3mm – DI box");
    expect(tracksR?.note).toBe("2x TS jack 6.3mm – DI box");
  });
});
