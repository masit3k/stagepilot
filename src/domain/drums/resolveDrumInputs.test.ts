import { describe, expect, it } from "vitest";
import { createDefaultDrumDefinition } from "./drumDefinition.js";
import { orderResolvedDrumInputs, resolveDrumActiveSlots, resolveDrumDefinitionInputs } from "./resolveDrumDefinitionInputs.js";
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

  it("assigns stable semantic ids from catalog", () => {
    const definition = createDefaultDrumDefinition();
    const kickIn = resolveDrumDefinitionInputs(definition).find((item) => item.key === "dr_kick_1_in");
    expect(kickIn?.id).toBe("kick_1_in");
  });

  it("resolves active slots from domain state", () => {
    const definition = createDefaultDrumDefinition();
    definition.kickCount = 1;
    definition.kicks = [{ in: true, out: true }];
    definition.pad = { enabled: true, mode: "backing", channels: "stereo" };
    const slots = resolveDrumActiveSlots(definition);
    expect(slots).toContain("kick_1_out");
    expect(slots).toContain("kick_1_in");
    expect(slots).not.toContain("kick_2_out");
    expect(slots).toContain("pad_stereo_backing_l");
    expect(slots).toContain("pad_stereo_backing_r");
  });


  it("orders tracks after pad and overheads", () => {
    const definition = createDefaultDrumDefinition();
    definition.pad = { enabled: true, mode: "sfx", channels: "mono" };
    definition.tracks = { enabled: true };

    const keys = resolveDrumDefinitionInputs(definition).map((item) => item.key);
    expect(keys.indexOf("dr_tracks_l")).toBeGreaterThan(keys.indexOf("dr_pad_mono_sfx"));

    definition.pad = { enabled: false };
    const withoutPad = resolveDrumDefinitionInputs(definition).map((item) => item.key);
    expect(withoutPad.indexOf("dr_tracks_l")).toBeGreaterThan(withoutPad.indexOf("dr_oh_r"));
  });

  it("keeps ordering deterministic via metadata ordering helper", () => {
    const ordered = orderResolvedDrumInputs([
      { key: "dr_tracks_l", id: "tracks_l", label: "Playback L", note: "", slot: "tracks_l", order: 260, category: "tracks" },
      { key: "dr_oh_l", id: "overheads_l", label: "OH L", note: "", slot: "overheads_l", order: 190, category: "overhead", side: "l" },
      { key: "dr_pad_mono_sfx", id: "pad_sfx_mono", label: "PAD SFX", note: "", slot: "pad_mono_sfx", order: 210, category: "pad", mode: "sfx", channels: "mono" },
    ]);
    expect(ordered.map((item) => item.key)).toEqual(["dr_oh_l", "dr_pad_mono_sfx", "dr_tracks_l"]);
  });

  it("keeps pad and tracks separation", () => {
    const definition = createDefaultDrumDefinition();
    definition.pad = { enabled: true, mode: "sfx", channels: "stereo" };
    definition.tracks = { enabled: false };

    const keysWithoutTracks = resolveDrumDefinitionInputs(definition).map((item) => item.key);
    expect(keysWithoutTracks).toContain("dr_pad_stereo_sfx_l");
    expect(keysWithoutTracks).toContain("dr_pad_stereo_sfx_r");
    expect(keysWithoutTracks).not.toContain("dr_tracks_l");

    definition.tracks = { enabled: true };
    const keysWithTracks = resolveDrumDefinitionInputs(definition).map((item) => item.key);
    expect(keysWithTracks).toContain("dr_tracks_l");
    expect(keysWithTracks).toContain("dr_tracks_r");
  });
});
