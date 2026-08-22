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

/**
 * Zkratka pro testy, které se zajímají jen o tvar řádku. Ostatní testy v tomhle
 * souboru si props vypisují celé, protože si mění i `ownerName`, `channelCount`
 * nebo `deviationCount`.
 */
function renderInspector(rowOverrides: Partial<InputEditorRow>): string {
  return renderToStaticMarkup(
    <InputRowInspector
      row={makeRow(rowOverrides)}
      ownerName="Gita Guitar"
      channelCount={2}
      deviationCount={0}
      canSaveAsMusicianDefault={false}
      onLabelChange={noop}
      onNoteChange={noop}
      onResetToDefault={noop}
      onSaveAsMusicianDefault={noop}
      onRemoveChannel={noop}
      onRestoreChannel={noop}
      onEditKit={noop}
      onEditInputs={noop}
    />,
  );
}

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
        onEditKit={noop}
        onEditInputs={noop}
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
        onEditKit={noop}
        onEditInputs={noop}
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
        onEditKit={noop}
        onEditInputs={noop}
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
        onEditKit={noop}
        onEditInputs={noop}
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
        onEditKit={noop}
        onEditInputs={noop}
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
  //
  // Task 16 gives the row a real action instead: `Edit kit` writes
  // `lineup.drums[i].drumDefinition`, which the document does read, so it
  // stays enabled and its hint replaces the old "Edit kit [Coming soon]" +
  // separate Remove/Restore notice with one sentence.
  it("hides Remove channel for a drums-owned row, offering an enabled Edit kit and one unified hint instead", () => {
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
        onEditKit={noop}
        onEditInputs={noop}
      />,
    );

    expect(html).not.toContain("Remove channel");
    const editKitButtonHtml = html
      .split("<button")
      .find((chunk) => chunk.includes("Edit kit"));
    expect(editKitButtonHtml).toBeDefined();
    expect(editKitButtonHtml).not.toContain("disabled");
    expect(html).toMatch(/not remove or restore/i);
    expect(html).not.toMatch(/not editable here/i);
  });

  it("hides Restore channel for a removed drums-owned row, with the same unified hint", () => {
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
        onEditKit={noop}
        onEditInputs={noop}
      />,
    );

    expect(html).not.toContain("Restore channel");
    expect(html).toMatch(/not remove or restore/i);
    expect(html).not.toMatch(/not editable here/i);
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
        onEditKit={noop}
        onEditInputs={noop}
      />,
    );

    expect(html).not.toContain("Remove channel");
    expect(html).toMatch(/not editable here/i);
    expect(html).toMatch(/vocal or talkback channel/i);
  });

  // Fix round 2, Important 1: a drummer's own back-vocal overlay row
  // (`ownerRole: "drums"`, `group: "vocs"`) is not a drum-kit channel.
  // `resolveInputRowEditability` now checks `group` before `ownerRole`, so
  // this row gets `overlay-not-supported`, not `drums-not-supported` — the
  // hint must talk about the vocal channel, not claim `Edit kit` covers it.
  // `Edit kit` itself still renders (it is ownership-based, `row.ownerRole
  // === "drums"`, a deliberate choice — see fix round 2 report — since the
  // drummer genuinely owns a kit to edit even while this particular row is
  // his vocal channel), but the hint next to Remove/Restore must not lie
  // about what that button does for this row.
  it("gives a drummer's own back-vocal overlay row the vocal hint, not the drum-kit one, even though Edit kit still renders", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={makeRow({
          key: "voc_back_drums_1",
          rawKey: "voc_back_drums_1",
          label: "Back Vocal",
          group: "vocs",
          ownerRole: "drums",
          state: "active",
        })}
        ownerName="Dana Drummer"
        channelCount={6}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
        onEditKit={noop}
        onEditInputs={noop}
      />,
    );

    expect(html).toContain("Edit kit");
    expect(html).not.toContain("Remove channel");
    expect(html).not.toContain("Restore channel");
    expect(html).toMatch(/vocal or talkback channel/i);
    expect(html).not.toMatch(/drum kit channels/i);
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
        onEditKit={noop}
        onEditInputs={noop}
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
        onEditKit={noop}
        onEditInputs={noop}
      />,
    );

    expect(html).toContain("Remove channel");
    expect(html).not.toMatch(/not editable here/i);
  });

  it("offers Edit inputs on a guitar row", () => {
    const html = renderInspector({
      key: "el_guitar_mic",
      rawKey: "el_guitar_mic",
      label: "El. Guitar MIC",
      group: "guitar",
      ownerRole: "guitar",
    });

    expect(html).toContain(">Edit inputs</button>");
  });

  it("does not offer Edit inputs on a drums row — the kit has its own editor", () => {
    const html = renderInspector({
      key: "dr_kick_1_out",
      rawKey: "dr_kick_1_out",
      label: "Kick OUT",
      group: "drums",
      ownerRole: "drums",
    });

    expect(html).not.toContain("Edit inputs");
    expect(html).toContain(">Edit kit</button>");
  });

  // OQ-1 (2026-08-21): the vocal slot never gets the modal. This is the UI half
  // of the gate whose document half is locked in `uiDocumentContract.test.ts`
  // ("the document still prints an ownerless row for add on an overlay slot"):
  // `buildDocument.ts:610-612` excludes only `bass` and `drums` from the
  // `eventOverride` branch, so an `inputs.add` written on a `vocs` slot becomes
  // a permanent orphan row with `ownerMusicianId: undefined` that steals
  // channel 1 from the real lead vocal. The domain does not duplicate this
  // gate — this button is the only door to it, so it must stay shut.
  it("does not offer Edit inputs on a lead-vocal row (OQ-1)", () => {
    const html = renderInspector({
      key: "voc_lead_1",
      rawKey: "voc_lead_1",
      label: "Lead vocal 1 (female)",
      group: "vocs",
      ownerRole: "vocs",
      labelIsCanonical: true,
    });

    expect(html).not.toContain("Edit inputs");
    // Not vacuous: the actions block itself renders — only the button is gone.
    expect(html).toContain(">Reset to default</button>");
  });

  // Owner action over his instrument, not over the overlay row — same shape
  // as `Edit kit` on a drummer's back-vocal row: keyed on `ownerRole`, not on
  // `group`, so a guitarist who lost every instrument channel can still get
  // back to his own connection.
  it("offers Edit inputs on a guitarist's back-vocal overlay row", () => {
    const html = renderInspector({
      key: "voc_back_guitar_2",
      rawKey: "voc_back_guitar_2",
      label: "Back Vocal",
      group: "vocs",
      ownerRole: "guitar",
      labelIsCanonical: true,
    });

    expect(html).toContain(">Edit inputs</button>");
  });
});
