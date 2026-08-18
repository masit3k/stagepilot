import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { InputEditorRow } from "../../domain/inputs/buildInputEditorRows";
import { InputRowInspector } from "./InputRowInspector";

function makeRow(overrides: Partial<InputEditorRow>): InputEditorRow {
  return {
    key: "bass_di",
    rawKey: "bass_di",
    ch: 1,
    label: "Bass DI",
    note: "DI box",
    group: "bass",
    ownerRole: "bass",
    ownerMusicianId: "m1",
    slotKey: "bass:0",
    state: "active",
    labelIsCanonical: false,
    ...overrides,
  };
}

const noop = vi.fn();

describe("InputRowInspector", () => {
  it("disables the rename field and shows a hint for a row with a canonical label", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({
          key: "voc_lead_1",
          rawKey: "voc_lead_1",
          label: "Lead vocal 1 (female)",
          group: "vocs",
          ownerRole: "vocs",
          labelIsCanonical: true,
        })}
        ownerName="Vera Vocal"
        channelCount={1}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
      />,
    );

    expect(html).toContain(
      '<input type="text" disabled="" value="Lead vocal 1 (female)"/>',
    );
    expect(html).toMatch(/naming convention/i);
  });

  it("keeps the rename field enabled and shows no hint for a plain instrument row", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({})}
        ownerName="Ben Bass"
        channelCount={1}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
      />,
    );

    expect(html).toContain('<input type="text" value="Bass DI"/>');
    expect(html).not.toMatch(/naming convention/i);
  });

  it("always keeps the note field enabled, even on a canonical-label row", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({
          key: "dr_kick_1_out",
          rawKey: "dr_kick_1_out",
          label: "Kick OUT",
          group: "drums",
          ownerRole: "drums",
          note: "Beta 52A",
          labelIsCanonical: true,
        })}
        ownerName="Dana Drummer"
        channelCount={5}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
      />,
    );

    expect(html).toContain('<input type="text" value="Beta 52A"/>');
  });
});
