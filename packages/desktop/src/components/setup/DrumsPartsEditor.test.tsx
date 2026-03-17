import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DrumDefinition } from "../../../../../src/domain/drums/drumDefinition";
import { DrumsPartsEditor } from "./DrumsPartsEditor";

const baseSetup: DrumDefinition = {
  kickCount: 1,
  snareCount: 1,
  tomCount: 2,
  floorCount: 1,
  hasHiHat: true,
  hasOverheads: true,
  pad: { enabled: true, mode: "sfx", channels: "mono" },
  tracks: { enabled: true },
};

describe("DrumsPartsEditor", () => {
  it("renders Input and Additional inputs sections with required labels", () => {
    const html = renderToStaticMarkup(
      <DrumsPartsEditor setup={baseSetup} onChange={() => {}} />,
    );

    expect(html).toContain("Input");
    expect(html).toContain("Additional inputs");
    expect(html).toContain("Kicks");
    expect(html).toContain("Snares");
    expect(html).toContain("Hi-hat");
    expect(html).toContain("Toms");
    expect(html).toContain("Floors");
    expect(html).toContain("Overhead");
    expect(html).toContain("PAD");
    expect(html).toContain("Tracks");
    expect(html).not.toContain("Floor toms");
    expect(html).not.toContain("OH pair");
    expect(html).not.toContain("Tracks (stereo)");
  });

  it("renders counter rows using shared stepper classes", () => {
    const html = renderToStaticMarkup(
      <DrumsPartsEditor setup={baseSetup} onChange={() => {}} />,
    );

    expect(html).toContain('class="setup-stepper"');
    expect(html).toContain('aria-label="Decrease Kicks"');
    expect(html).toContain('aria-label="Increase Floors"');
  });
});
