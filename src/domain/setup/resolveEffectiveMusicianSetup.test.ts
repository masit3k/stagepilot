import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset, PresetOverridePatch } from "../model/types.js";
import { resolveEffectiveMusicianSetup } from "./resolveEffectiveMusicianSetup.js";

const defaults: MusicianSetupPreset = {
  inputs: [
    { key: "dr_kick_in", label: "Kick", group: "drums" },
    { key: "dr_snare_top", label: "Snare", group: "drums" },
  ],
  monitoring: { type: "wedge", mode: "mono", mixCount: 1 },
};

describe("resolveEffectiveMusicianSetup", () => {
  it("returns default origin when no override exists", () => {
    const result = resolveEffectiveMusicianSetup({ musicianDefaults: defaults, group: "drums" });
    expect(result.effectiveInputs.map((item) => item.key)).toEqual(["dr_kick_in", "dr_snare_top"]);
    expect(result.diffMeta.inputs.every((item) => item.origin === "default")).toBe(true);
  });

  it("marks added inputs as override", () => {
    const override: PresetOverridePatch = {
      inputs: { add: [{ key: "dr_oh_l", label: "OH L", group: "drums" }] },
    };
    const result = resolveEffectiveMusicianSetup({ musicianDefaults: defaults, eventOverride: override, group: "drums" });
    expect(result.diffMeta.inputs.find((item) => item.key === "dr_oh_l")).toMatchObject({
      origin: "override",
      changeType: "added",
    });
  });

  it("keeps removed default input in diff metadata", () => {
    const override: PresetOverridePatch = { inputs: { removeKeys: ["dr_snare_top"] } };
    const result = resolveEffectiveMusicianSetup({ musicianDefaults: defaults, eventOverride: override, group: "drums" });
    expect(result.effectiveInputs.map((item) => item.key)).toEqual(["dr_kick_in"]);
    expect(result.diffMeta.inputs.find((item) => item.key === "dr_snare_top")).toMatchObject({
      changeType: "removed",
      origin: "override",
    });
  });

  it("marks monitoring fields as override when patched", () => {
    const result = resolveEffectiveMusicianSetup({
      musicianDefaults: defaults,
      eventOverride: { monitoring: { mode: "stereo", mixCount: 2 } },
      group: "drums",
    });
    expect(result.effectiveMonitoring.mode).toBe("stereo");
    expect(result.diffMeta.monitoring.mode.origin).toBe("override");
  });

  it("returns to default after reset override", () => {
    const overridden = resolveEffectiveMusicianSetup({
      musicianDefaults: defaults,
      eventOverride: { inputs: { add: [{ key: "dr_oh_l", label: "OH L", group: "drums" }] } },
      group: "drums",
    });
    const reset = resolveEffectiveMusicianSetup({
      musicianDefaults: defaults,
      eventOverride: undefined,
      group: "drums",
    });
    expect(overridden.effectiveInputs).not.toEqual(reset.effectiveInputs);
    expect(reset.effectiveInputs.map((item) => item.key)).toEqual(["dr_kick_in", "dr_snare_top"]);
  });



  it("uses musician monitoring defaults when available", () => {
    const result = resolveEffectiveMusicianSetup({
      musicianDefaults: {
        inputs: defaults.inputs,
        monitoring: { type: "iem_wireless", mode: "stereo", mixCount: 2 },
      },
      group: "drums",
    });
    expect(result.effectiveMonitoring.type).toBe("iem_wireless");
    expect(result.diffMeta.monitoring.type.origin).toBe("default");
  });

  it("defaults monitoring type to wedge when missing", () => {
    const result = resolveEffectiveMusicianSetup({
      musicianDefaults: { inputs: defaults.inputs },
      group: "drums",
    });
    expect(result.effectiveMonitoring.type).toBe("wedge");
    expect(result.diffMeta.monitoring.type.origin).toBe("default");
  });

  it("migrates legacy iem monitoring override to explicit wired type", () => {
    const legacyOverride = { monitoring: { type: "iem", connection: "wired" } } as unknown as PresetOverridePatch;
    const result = resolveEffectiveMusicianSetup({
      musicianDefaults: defaults,
      eventOverride: legacyOverride,
      group: "drums",
    });
    expect(result.effectiveMonitoring.type).toBe("iem_wired");
  });

  it("produces deterministic output across reload", () => {
    const override: PresetOverridePatch = {
      monitoring: { type: "iem_wired", mode: "stereo", mixCount: 2 },
      inputs: { add: [{ key: "dr_oh_l", label: "OH L", group: "drums" }] },
    };
    const first = resolveEffectiveMusicianSetup({ musicianDefaults: defaults, eventOverride: override, group: "drums" });
    const second = resolveEffectiveMusicianSetup({ musicianDefaults: defaults, eventOverride: override, group: "drums" });
    expect(second).toEqual(first);
  });
});
