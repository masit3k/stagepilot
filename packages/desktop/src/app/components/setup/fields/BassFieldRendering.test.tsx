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
    setupGroup: "electric_bass",
    inputs: [{ key: "el_bass_xlr_amp", label: "Electric bass guitar", note: "XLR out from amp", group: "bass" }],
  },
  {
    type: "preset",
    id: "el_bass_xlr_pedalboard",
    label: "Electric bass guitar",
    group: "bass",
    setupGroup: "electric_bass",
    inputs: [{ key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", note: "XLR out from pedalboard", group: "bass" }],
  },
  {
    type: "preset",
    id: "el_bass_mic",
    label: "Electric bass mic",
    group: "bass",
    setupGroup: "bass_mic",
    inputs: [{ key: "el_bass_mic", label: "Electric bass mic", note: "Mic on bass amp", group: "bass" }],
  },
] satisfies BassPresetSource[];

const presets = toBassPresets(presetSource);

const defaultPreset: MusicianSetupPreset = {
  inputs: [
    { key: "el_bass_xlr_pedalboard", label: "Electric bass guitar", group: "bass" },
    { key: "el_bass_mic", label: "Electric bass mic", group: "bass" },
  ],
  monitoring: { monitorRef: "wedge" },
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

  it("renders mic toggle as checked when included in defaults", () => {
    const toggleGrid = buildBassFields(presets).find((field) => field.kind === "toggleGrid");
    if (!toggleGrid || toggleGrid.kind !== "toggleGrid") throw new Error("toggle grid missing");

    const html = renderToStaticMarkup(<ToggleField field={toggleGrid.fields[0]} state={{ defaultPreset, effectivePreset: defaultPreset }} onPatch={() => {}} />);
    expect(html).toContain("setup-toggle-row");
    expect(html).toContain("checked");
    expect(html).toContain("Mic on cabinet");
  });
  it("renders trailing controls inside toggle row", () => {
    const toggleGrid = buildBassFields(presets).find((field) => field.kind === "toggleGrid");
    if (!toggleGrid || toggleGrid.kind !== "toggleGrid") throw new Error("toggle grid missing");

    const html = renderToStaticMarkup(
      <ToggleField
        field={toggleGrid.fields[0]}
        state={{ defaultPreset, effectivePreset: defaultPreset }}
        trailing={<select className="setup-field-control setup-field-control--compact" aria-label="Count"><option>1</option></select>}
        onPatch={() => {}}
      />,
    );

    expect(html).toContain("setup-toggle-row__trailing");
    expect(html).toContain("setup-field-control--compact");
  });

});
