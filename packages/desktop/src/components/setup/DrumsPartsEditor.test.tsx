import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DrumDefinition } from "../../../../../src/domain/drums/drumDefinition";
import { DrumsPartsEditor, updateCountField, updateDrumToggleField } from "./DrumsPartsEditor";

const baseSetup: DrumDefinition = {
  kickCount: 1,
  kicks: [{ in: true, out: true }],
  snareCount: 1,
  snares: [{ top: true, bottom: true }],
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
    expect(html).toContain("Floor Toms");
    expect(html).toContain("Overhead");
    expect(html).toContain("PAD");
    expect(html).toContain("Backing track");
    expect(html).not.toContain("Floors");
    expect(html).not.toContain("OH pair");
    expect(html).not.toContain("Tracks (stereo)");
  });

  it("renders counter rows using shared stepper classes", () => {
    const html = renderToStaticMarkup(
      <DrumsPartsEditor setup={baseSetup} onChange={() => {}} />,
    );

    expect(html).toContain('class="setup-stepper"');
    expect(html).toContain('aria-label="Decrease Kicks"');
    expect(html).toContain('aria-label="Increase Floor Toms"');
  });

  it("updates kicks and snares counters through typed count fields", () => {
    const kickUpdate = updateCountField(baseSetup, "kickCount", 2);
    const snareUpdate = updateCountField(baseSetup, "snareCount", 2);

    expect(kickUpdate.kickCount).toBe(2);
    expect(kickUpdate.kicks[1]).toEqual({ in: true, out: true });
    expect(snareUpdate.snareCount).toBe(2);
    expect(snareUpdate.snares[1]).toEqual({ top: true, bottom: true });
  });

  it("updates backing track toggle through typed boolean field", () => {
    const toggle = updateDrumToggleField(baseSetup, "tracks.enabled", false);
    expect(toggle.tracks.enabled).toBe(false);
  });

  it("does not render obsolete generated inputs/remove UI", () => {
    const html = renderToStaticMarkup(
      <DrumsPartsEditor setup={baseSetup} onChange={() => {}} />,
    );

    expect(html).not.toContain("Remove");
    expect(html).not.toContain("Effective inputs");
    expect(html).not.toContain("No additional inputs available");
  });

  it("renders PAD settings as a subordinate vertical block", () => {
    const html = renderToStaticMarkup(
      <DrumsPartsEditor setup={baseSetup} onChange={() => {}} />,
    );

    expect(html).toContain('data-testid="pad-settings"');
    expect(html).toContain('class="setup-pad-settings__row"><label>Mode');
    expect(html).toContain('class="setup-pad-settings__row"><label>Channels');
    expect(html).toContain('Mode<select class="setup-field-control"');
    expect(html).toContain('Channels<select class="setup-field-control"');
  });

  it("scopes mode and channels controls to PAD only", () => {
    const htmlWithPad = renderToStaticMarkup(
      <DrumsPartsEditor setup={baseSetup} onChange={() => {}} />,
    );
    expect(htmlWithPad).toContain("Mode");
    expect(htmlWithPad).toContain("Channels");

    const htmlWithoutPad = renderToStaticMarkup(
      <DrumsPartsEditor
        setup={{ ...baseSetup, pad: { enabled: false }, tracks: { enabled: true } }}
        onChange={() => {}}
      />,
    );
    expect(htmlWithoutPad).not.toContain("Mode");
    expect(htmlWithoutPad).not.toContain("Channels");
    expect(htmlWithoutPad).toContain("Backing track");
  });
});
