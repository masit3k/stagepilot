import { describe, expect, it } from "vitest";
import type {
  MusicianSetupPreset,
  PresetEntity,
} from "../../../../../../src/domain/model/types";
import type { BandSetupData } from "../../shell/types";
import {
  resolveMusicianDefaultPreset,
  resolveSetupForSlot,
} from "./resolveSetupForSlot";

const EMPTY_CATALOG: Record<string, PresetEntity> = {};

/**
 * Fixtura drží skutečný tvar `BandSetupData` — `id`, `name` a `members` jsou
 * povinné, i když je tenhle test nepoužívá. Nesmí se obcházet přetypováním,
 * jinak by test přestal hlídat rozpad typu.
 */
function setupDataWith(
  musicianDefaults: Record<string, Partial<MusicianSetupPreset>>,
): BandSetupData {
  return {
    id: "band-1",
    name: "Test band",
    members: {},
    musicianDefaults,
  };
}

describe("resolveMusicianDefaultPreset", () => {
  it("falls back to the band default when there is no setup data", () => {
    const preset = resolveMusicianDefaultPreset({
      role: "bass",
      musicianId: "m1",
      setupData: null,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(preset.inputs).toBeInstanceOf(Array);
    expect(preset.monitoring).toBeDefined();
    // Band default pro `bass` je jediný kanál z `GROUP_INPUT_LIBRARY`. Kdyby
    // fallback spadl jinam (na prázdný preset nebo na jinou roli), tohle to
    // odhalí — samotné `toBeInstanceOf(Array)` ne.
    expect(preset.inputs.map((input) => input.key)).toEqual([
      "el_bass_xlr_amp",
    ]);
    expect(preset.inputs[0]?.label).toBe("Electric bass guitar");
    expect(preset.monitoring.monitorRef).toBe("wedge_foh");
  });

  it("prefers role scoped defaults over generic ones", () => {
    const setupData = setupDataWith({
      "m1:bass": { inputs: [{ key: "role_scoped", label: "Role scoped" }] },
      m1: { inputs: [{ key: "generic", label: "Generic" }] },
    });

    const preset = resolveMusicianDefaultPreset({
      role: "bass",
      musicianId: "m1",
      setupData,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(preset.inputs.map((input) => input.key)).toContain("role_scoped");
    expect(preset.inputs.map((input) => input.key)).not.toContain("generic");
  });
});

describe("resolveSetupForSlot", () => {
  it("returns the default setup when there is no patch", () => {
    const { effective } = resolveSetupForSlot({
      role: "bass",
      musicianId: "m1",
      setupData: null,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(effective.inputs).toBeInstanceOf(Array);
    expect(effective.inputs.map((input) => input.key)).toEqual([
      "el_bass_xlr_amp",
    ]);
    expect(effective.monitoring.monitorRef).toBe("wedge_foh");
  });

  it("applies a remove patch to the effective inputs", () => {
    const setupData = setupDataWith({
      "m1:bass": {
        inputs: [
          { key: "el_bass_di", label: "Bass DI" },
          { key: "el_bass_mic", label: "Bass mic" },
        ],
      },
    });

    const { resolved, effective } = resolveSetupForSlot({
      role: "bass",
      musicianId: "m1",
      patch: { inputs: { remove: ["el_bass_mic"] } },
      setupData,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(effective.inputs.map((input) => input.key)).not.toContain(
      "el_bass_mic",
    );
    expect(effective.inputs.map((input) => input.key)).toContain("el_bass_di");
    // `resolved` musí nést nepatchovaný default — na tom stojí volání
    // `resolveSlotSetup(...).resolved.defaultPreset` na obrazovce `01`.
    expect(resolved.defaultPreset.inputs.map((input) => input.key)).toContain(
      "el_bass_mic",
    );
  });

  it("applies a label update patch to the effective inputs", () => {
    const setupData = setupDataWith({
      "m1:bass": { inputs: [{ key: "el_bass_di", label: "Bass DI" }] },
    });

    const { effective } = resolveSetupForSlot({
      role: "bass",
      musicianId: "m1",
      patch: {
        inputs: { update: [{ key: "el_bass_di", label: "Matěj bass" }] },
      },
      setupData,
      presetCatalog: EMPTY_CATALOG,
    });

    expect(
      effective.inputs.find((input) => input.key === "el_bass_di")?.label,
    ).toBe("Matěj bass");
  });
});
