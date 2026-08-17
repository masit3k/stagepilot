import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset } from "../../../../../../src/domain/model/types";
import { buildMusicianDefaultPayload } from "./buildMusicianDefaultPayload";

describe("buildMusicianDefaultPayload", () => {
  const effectivePreset: MusicianSetupPreset = {
    inputs: [{ key: "el_bass_di", label: "Bass DI", group: "bass" }],
    monitoring: { monitorRef: "wedge", additionalWedgeCount: 1 },
  };

  it("carries the owner's musician id and role alongside the effective preset", () => {
    const payload = buildMusicianDefaultPayload({
      ownerMusicianId: "m1",
      ownerRole: "bass",
      effectivePreset,
    });

    expect(payload).toEqual({
      musicianId: "m1",
      role: "bass",
      setup: effectivePreset,
    });
    // Same reference, not a reshaped copy.
    expect(payload.setup).toBe(effectivePreset);
  });

  it("sends the resolved preset's channel list, never a patch's add/remove shape", () => {
    const payload = buildMusicianDefaultPayload({
      ownerMusicianId: "m1",
      ownerRole: "bass",
      effectivePreset,
    });

    // `MusicianSetupPreset.inputs` is an `InputChannel[]`. A
    // `PresetOverridePatch` has no such array — only an optional
    // `{ add?, remove?, replace?, removeKeys?, update? }` object under
    // `inputs`. This is exactly the shape check that would fail if a future
    // change wired the raw slot patch into this payload instead of the
    // resolved effective preset.
    expect(Array.isArray(payload.setup.inputs)).toBe(true);
    expect(payload.setup.inputs).toEqual(effectivePreset.inputs);
  });
});
