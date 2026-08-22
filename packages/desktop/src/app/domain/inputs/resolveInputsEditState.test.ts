import { describe, expect, it } from "vitest";
import type { PresetEntity } from "../../../../../../src/domain/model/types";
import type { BandSetupData } from "../../shell/types";
import { resolveSetupForSlot } from "../setup/resolveSetupForSlot";
import { resolveInputsEditState } from "./resolveInputsEditState";

const CATALOG: Record<string, PresetEntity> = {
  el_guitar_mic: {
    type: "preset",
    id: "el_guitar_mic",
    label: "Electric guitar (mic)",
    group: "guitar",
    inputs: [
      {
        key: "el_guitar_mic",
        label: "Electric guitar",
        note: "Mic on cabinet",
      },
    ],
  },
  wedge_foh: {
    type: "monitor",
    id: "wedge_foh",
    label: "Wedge",
    kind: "wedge",
    supplier: "foh",
  },
};

function setupDataWith(presetRefs: string[]): BandSetupData {
  return {
    id: "band-1",
    name: "Test band",
    members: {},
    musicianPresetsById: {
      m1: presetRefs.map((ref) => ({ kind: "preset", ref })),
    },
  } as BandSetupData;
}

describe("resolveInputsEditState", () => {
  it("returns the unpatched default and the patched effective preset side by side", () => {
    const state = resolveInputsEditState({
      role: "guitar",
      musicianId: "m1",
      patch: {
        inputs: { update: [{ key: "el_guitar_mic", label: "Matej guitar" }] },
      },
      setupData: setupDataWith(["el_guitar_mic"]),
      presetCatalog: CATALOG,
    });

    expect(state.defaultPreset.inputs.map((i) => i.label)).toEqual([
      "Electric guitar",
    ]);
    expect(state.effectivePreset.inputs.map((i) => i.label)).toEqual([
      "Matej guitar",
    ]);
    expect(state.patch).toEqual({
      inputs: { update: [{ key: "el_guitar_mic", label: "Matej guitar" }] },
    });
  });

  it("returns an effective preset equal to the default when there is no patch", () => {
    const state = resolveInputsEditState({
      role: "guitar",
      musicianId: "m1",
      patch: undefined,
      setupData: setupDataWith(["el_guitar_mic"]),
      presetCatalog: CATALOG,
    });

    expect(state.effectivePreset.inputs.map((i) => i.key)).toEqual(
      state.defaultPreset.inputs.map((i) => i.key),
    );
    expect(state.patch).toBeUndefined();
  });

  it("agrees with setupForSlot for every role the modal is offered for", () => {
    // The modal reads this state; the inspector and the table read
    // `setupForSlot`. If the two ever disagree, the modal edits a preset the
    // rest of the screen does not show.
    for (const role of ["bass", "guitar", "keys"] as const) {
      const state = resolveInputsEditState({
        role,
        musicianId: "m1",
        patch: undefined,
        setupData: setupDataWith([]),
        presetCatalog: CATALOG,
      });

      const { resolved, effective } = resolveSetupForSlot({
        role,
        musicianId: "m1",
        setupData: setupDataWith([]),
        presetCatalog: CATALOG,
      });

      expect(state.defaultPreset).toEqual(resolved.defaultPreset);
      expect(state.effectivePreset).toEqual(effective);
      expect(state.effectivePreset.monitoring.monitorRef).toBe("wedge_foh");
      expect(Array.isArray(state.effectivePreset.inputs)).toBe(true);
    }
  });

  it("falls back to an empty preset when there is no setup data at all", () => {
    const state = resolveInputsEditState({
      role: "guitar",
      musicianId: "m1",
      patch: undefined,
      setupData: null,
      presetCatalog: {},
    });

    expect(state.defaultPreset.inputs).toEqual([]);
    expect(state.effectivePreset.inputs).toEqual([]);
  });
});
