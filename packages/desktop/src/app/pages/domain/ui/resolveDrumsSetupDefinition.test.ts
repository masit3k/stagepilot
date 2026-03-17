import { describe, expect, it } from "vitest";
import {
  createDefaultDrumDefinition,
  type DrumDefinition,
} from "../../../../../../../src/domain/drums/drumDefinition";
import { resolveDrumsSetupDefinition } from "./resolveDrumsSetupDefinition";

describe("resolveDrumsSetupDefinition", () => {
  const musicianDefault: DrumDefinition = {
    ...createDefaultDrumDefinition(),
    kickCount: 2,
    kicks: [
      { in: true, out: true },
      { in: true, out: false },
    ],
  };

  const slotOverride: DrumDefinition = {
    ...createDefaultDrumDefinition(),
    snareCount: 2,
    snares: [
      { top: true, bottom: true },
      { top: true, bottom: false },
    ],
  };

  it("uses drummer musician default when slot-level drum definition is missing (string slot projects)", () => {
    const resolved = resolveDrumsSetupDefinition({
      musicianPresetItems: [{ kind: "drum_setup", setup: musicianDefault }],
    });

    expect(resolved).toEqual(musicianDefault);
  });

  it("keeps slot-level drum definition precedence over musician default", () => {
    const resolved = resolveDrumsSetupDefinition({
      slotDrumDefinition: slotOverride,
      musicianPresetItems: [{ kind: "drum_setup", setup: musicianDefault }],
    });

    expect(resolved).toEqual(slotOverride);
  });

  it("falls back to deterministic default when no slot or musician default exists", () => {
    const resolved = resolveDrumsSetupDefinition({
      musicianPresetItems: [{ kind: "preset", ref: "drums-standard" }],
    });

    expect(resolved).toEqual(createDefaultDrumDefinition());
  });
});
