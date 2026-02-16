import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset, Preset } from "../../../../../../../../../src/domain/model/types";
import { buildBassFields, toBassPresets } from "../instruments/bass/buildBassFields";
import { DropdownField } from "./DropdownField";
import { ToggleField } from "./ToggleField";

const presets = toBassPresets([
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
    id: "el_bass_mic",
    label: "Electric bass mic",
    group: "bass",
    setupGroup: "bass_mic",
    inputs: [{ key: "el_bass_mic", label: "Electric bass mic", note: "Mic on bass amp", group: "bass" }],
  },
] as Preset[]);

const defaultPreset: MusicianSetupPreset = {
  inputs: [
    { key: "el_bass_xlr_amp", label: "Electric bass guitar", group: "bass" },
    { key: "voc_back_bass", label: "Back vocal – bass", group: "vocs" },
  ],
  monitoring: { type: "wedge", mode: "mono", mixCount: 1 },
};

describe("Bass setup field rendering", () => {
  it("renders back vocal checked from default preset", () => {
    const backVocal = buildBassFields(presets).find((field) => field.kind === "toggle" && field.id === "bass-back-vocal");
    if (!backVocal || backVocal.kind !== "toggle") throw new Error("back vocal field missing");

    const html = renderToStaticMarkup(<ToggleField field={backVocal} state={{ defaultPreset, effectivePreset: defaultPreset }} onPatch={() => {}} />);
    expect(html).toContain("checked");
    expect(html).toContain("Default");
    expect(html).toContain("setup-checkbox");
  });

  it("renders compact badge and wide control classes", () => {
    const connection = buildBassFields(presets).find((field) => field.kind === "dropdown");
    if (!connection || connection.kind !== "dropdown") throw new Error("connection field missing");

    const html = renderToStaticMarkup(<DropdownField field={connection} state={{ defaultPreset, effectivePreset: defaultPreset }} onPatch={() => {}} />);
    expect(html).toContain("setup-field-control");
    expect(html).toContain("setup-badge");
    expect(html).not.toContain("w-100");
  });
});
