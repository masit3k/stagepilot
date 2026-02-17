import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset, PresetOverridePatch } from "../model/types.js";
import { resolveEffectiveMusicianSetup } from "./resolveEffectiveMusicianSetup.js";

const defaults: MusicianSetupPreset = {
  inputs: [
    { key: "dr_kick_in", label: "Kick", group: "drums" },
    { key: "dr_snare_top", label: "Snare", group: "drums" },
  ],
  monitoring: { monitorRef: "iem_stereo_wireless" },
};

describe("resolveEffectiveMusicianSetup", () => {
  it("applies monitoring monitorRef override over defaults", () => {
    const result = resolveEffectiveMusicianSetup({
      musicianDefaults: defaults,
      eventOverride: { monitoring: { monitorRef: "iem_stereo_wired" } },
      group: "drums",
    });
    expect(result.effectiveMonitoring.monitorRef).toBe("iem_stereo_wired");
    expect(result.diffMeta.monitoring.monitorRef.origin).toBe("override");
  });

  it("supports additional wedge overrides", () => {
    const enabled = resolveEffectiveMusicianSetup({
      musicianDefaults: defaults,
      eventOverride: { monitoring: { additionalWedgeCount: 1 } },
      group: "drums",
    });
    expect(enabled.effectiveMonitoring.additionalWedgeCount).toBe(1);

    const changed = resolveEffectiveMusicianSetup({
      musicianDefaults: defaults,
      eventOverride: { monitoring: { additionalWedgeCount: 3 } },
      group: "drums",
    });
    expect(changed.effectiveMonitoring.additionalWedgeCount).toBe(3);

    const disabled = resolveEffectiveMusicianSetup({
      musicianDefaults: defaults,
      eventOverride: undefined,
      group: "drums",
    });
    expect(disabled.effectiveMonitoring.additionalWedgeCount).toBeUndefined();
  });

  it("remains deterministic", () => {
    const override: PresetOverridePatch = {
      monitoring: { monitorRef: "iem_stereo_wired", additionalWedgeCount: 2 },
      inputs: { add: [{ key: "dr_oh_l", label: "OH L", group: "drums" }] },
    };
    const first = resolveEffectiveMusicianSetup({ musicianDefaults: defaults, eventOverride: override, group: "drums" });
    const second = resolveEffectiveMusicianSetup({ musicianDefaults: defaults, eventOverride: override, group: "drums" });
    expect(second).toEqual(first);
  });
});
