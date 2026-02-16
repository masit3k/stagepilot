import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset } from "../../../../../../../src/domain/model/types";
import { buildBassFields, toBassPresets } from "../instruments/bass/buildBassFields";
import { DropdownField } from "./DropdownField";
import { ToggleField } from "./ToggleField";

type BassPresetSource = Parameters<typeof toBassPresets>[0][number];

const presetSource = [
  {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Electric bass guitar",
    group: "bass",
    inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" }],
  },
  {
    type: "preset",
    id: "el_bass_mic",
    label: "Electric bass mic",
    group: "bass",
    inputs: [{ key: "el_bass_mic", label: "Electric bass mic", note: "Mic on bass amp", group: "bass" }],
  },
] satisfies BassPresetSource[];

const presets = toBassPresets(presetSource);

const defaultPreset: MusicianSetupPreset = {
  inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", group: "bass" }],
  monitoring: { type: "wedge", mode: "mono", mixCount: 1 },
};

describe("Bass setup field rendering", () => {
  it("renders compact control classes", () => {
    const connection = buildBassFields(presets).find((field) => field.kind === "dropdown");
    if (!connection || connection.kind !== "dropdown") throw new Error("connection field missing");

    const html = renderToStaticMarkup(<DropdownField field={connection} state={{ defaultPreset, effectivePreset: defaultPreset }} onPatch={() => {}} />);
    expect(html).toContain("setup-field-control");
    expect(html).not.toContain("setup-badge");
    expect(html).not.toContain("w-100");
  });



  it("keeps connection label accessible without visible heading", () => {
    const connection = buildBassFields(presets).find((field) => field.kind === "dropdown");
    if (!connection || connection.kind !== "dropdown") throw new Error("connection field missing");

    const html = renderToStaticMarkup(<DropdownField field={connection} state={{ defaultPreset, effectivePreset: defaultPreset }} onPatch={() => {}} />);
    expect(html).toContain('aria-label="Connection"');
    expect(html).not.toContain(">Connection<");
  });

  it("renders larger checkbox row hit target", () => {
    const toggleGrid = buildBassFields(presets).find((field) => field.kind === "toggleGrid");
    if (!toggleGrid || toggleGrid.kind !== "toggleGrid") throw new Error("toggle grid missing");

    const html = renderToStaticMarkup(<ToggleField field={toggleGrid.fields[0]} state={{ defaultPreset, effectivePreset: defaultPreset }} onPatch={() => {}} />);
    expect(html).toContain("setup-toggle-row");
    expect(html).toContain("setup-checkbox");
    expect(html).toContain("Mic on cabinet");
    expect(html).not.toContain("Enable");
    expect(html).not.toContain("Default");
  });
});
