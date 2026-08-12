import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset } from "../model/types.js";
import { computeSetupDiff } from "./computeSetupDiff.js";

const defaultPreset: MusicianSetupPreset = {
  inputs: [],
  monitoring: { monitorRef: "iem_stereo_wireless_foh" },
};

describe("computeSetupDiff", () => {
  it("reports no override when eventOverride is absent", () => {
    const diff = computeSetupDiff({
      defaultPreset,
      effectivePreset: defaultPreset,
      eventOverride: undefined,
    });

    expect(diff.monitoring.monitorRef).toEqual({
      origin: "default",
      changeType: "unchanged",
    });
  });

  it("treats a legacy monitor alias equivalent to the default as unchanged", () => {
    // "iem_stereo_wireless" is a legacy alias that resolves to the default's
    // canonical "iem_stereo_wireless_foh" — re-selecting the already-active
    // supplier must not surface as a spurious "modified" badge.
    const diff = computeSetupDiff({
      defaultPreset,
      effectivePreset: {
        inputs: [],
        monitoring: { monitorRef: "iem_stereo_wireless_foh" },
      },
      eventOverride: { monitoring: { monitorRef: "iem_stereo_wireless" } },
    });

    expect(diff.monitoring.monitorRef).toEqual({
      origin: "default",
      changeType: "unchanged",
    });
  });

  it("still reports a real monitor change as an override", () => {
    const diff = computeSetupDiff({
      defaultPreset,
      effectivePreset: { inputs: [], monitoring: { monitorRef: "wedge_foh" } },
      eventOverride: { monitoring: { monitorRef: "wedge_foh" } },
    });

    expect(diff.monitoring.monitorRef).toEqual({
      origin: "override",
      changeType: "added",
    });
  });
});
