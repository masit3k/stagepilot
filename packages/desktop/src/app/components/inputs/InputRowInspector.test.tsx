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
        onRemoveChannel={noop}
        onRestoreChannel={noop}
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
        onRemoveChannel={noop}
        onRestoreChannel={noop}
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
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).toContain('<input type="text" value="Beta 52A"/>');
  });

  it("offers Remove channel, not Restore channel, for an active row (R3)", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({ state: "active" })}
        ownerName="Ben Bass"
        channelCount={1}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).toContain("Remove channel");
    expect(html).not.toContain("Restore channel");
  });

  it("offers Restore channel, not Remove channel, for a removed row (R3)", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({ state: "removed", ch: null })}
        ownerName="Ben Bass"
        channelCount={1}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).toContain("Restore channel");
    expect(html).not.toContain("Remove channel");
  });

  // Ruling (task 13b): `resolveEffectiveProjectSetup` reads only
  // `inputs.update` for a drums slot (task 12c fix round 1) — `add`/`remove`
  // written from this panel never reach the printed document. Without this
  // gate, clicking `Remove channel` strikes the row through while the
  // document keeps printing it unchanged — an active false confirmation of
  // success, not just silence.
  it("hides Remove channel for a drums-owned row and explains why, instead of offering a silently-dropped action", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({
          key: "dr_kick_1_out",
          rawKey: "dr_kick_1_out",
          label: "Kick OUT",
          group: "drums",
          ownerRole: "drums",
          state: "active",
        })}
        ownerName="Dana Drummer"
        channelCount={5}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).not.toContain("Remove channel");
    expect(html).toMatch(/not editable here/i);
    expect(html).toMatch(/drum channel/i);
  });

  it("hides Restore channel for a removed drums-owned row and explains why", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({
          key: "dr_kick_1_out",
          rawKey: "dr_kick_1_out",
          label: "Kick OUT",
          group: "drums",
          ownerRole: "drums",
          state: "removed",
          ch: null,
        })}
        ownerName="Dana Drummer"
        channelCount={5}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).not.toContain("Restore channel");
    expect(html).toMatch(/not editable here/i);
  });

  // Ruling (task 13b): the criterion is `row.group`, not `row.ownerRole` — a
  // back-vocal overlay row owned by a bassist carries `ownerRole: "bass"`
  // but `group: "vocs"`. `narrowPatchToUpdatesFor`
  // (`src/domain/pipeline/buildDocument.ts:213-220`) only forwards `update`
  // for this row, so `Remove channel` would be a silent no-op.
  it("hides Remove channel for a vocal overlay row owned by an instrumentalist, keyed by group not ownerRole", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({
          key: "voc_back_bass_2",
          rawKey: "voc_back_bass_2",
          label: "Back Vocal",
          group: "vocs",
          ownerRole: "bass",
          state: "active",
        })}
        ownerName="Ben Bass"
        channelCount={2}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).not.toContain("Remove channel");
    expect(html).toMatch(/not editable here/i);
    expect(html).toMatch(/vocal or talkback channel/i);
  });

  it("hides Remove channel for the talkback row regardless of the owner's instrument role", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({
          key: "tb_bass",
          rawKey: "tb_bass",
          label: "Talkback (Bass)",
          group: "talkback",
          ownerRole: "bass",
          state: "active",
        })}
        ownerName="Ben Bass"
        channelCount={2}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).not.toContain("Remove channel");
    expect(html).toMatch(/not editable here/i);
  });

  it("still offers Remove channel for a plain instrument row (regression guard)", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({ state: "active" })}
        ownerName="Ben Bass"
        channelCount={1}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).toContain("Remove channel");
    expect(html).not.toMatch(/not editable here/i);
  });
});
