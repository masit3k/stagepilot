import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../../components/ui/toast/ToastProvider";
import { InputRowInspector } from "../components/inputs/InputRowInspector";
import { InputTable } from "../components/inputs/InputTable";
import type { InputEditorRow } from "../domain/inputs/buildInputEditorRows";
import { ProjectInputsPage, isInputsDirty } from "./ProjectInputsPage";

describe("isInputsDirty", () => {
  const empty = { inputOrder: undefined, notes: undefined, lineup: {} };

  it("is clean when nothing changed", () => {
    expect(isInputsDirty(empty, empty)).toBe(false);
  });

  it("is dirty once a manual order appears", () => {
    expect(isInputsDirty(empty, { ...empty, inputOrder: ["kick_in"] })).toBe(
      true,
    );
  });

  it("is dirty once notes deviate", () => {
    expect(isInputsDirty(empty, { ...empty, notes: { disabled: ["x"] } })).toBe(
      true,
    );
  });

  it("is dirty when a slot patch changed", () => {
    expect(
      isInputsDirty(empty, {
        ...empty,
        lineup: {
          bass: [
            { musicianId: "m1", presetOverride: { inputs: { remove: ["x"] } } },
          ],
        },
      }),
    ).toBe(true);
  });

  it("is clean when both snapshots carry equal notes deviations", () => {
    expect(
      isInputsDirty(
        { ...empty, notes: { disabled: ["a", "b"] } },
        { ...empty, notes: { disabled: ["a", "b"] } },
      ),
    ).toBe(false);
  });
});

describe("ProjectInputsPage", () => {
  it("renders the three document sections", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <ProjectInputsPage
          id="p1"
          navigate={() => undefined}
          registerNavigationGuard={() => () => undefined}
        />
      </ToastProvider>,
    );

    expect(html).toContain("INPUT LIST");
    expect(html).toContain("MONITORS");
    expect(html).toContain("NOTES");
    // No row is selected before the project finishes loading.
    expect(html).toContain("NO CHANNEL SELECTED");
  });
});

describe("InputRowInspector (the panel for the selected row, R2)", () => {
  const editableRow: InputEditorRow = {
    key: "el_bass_di",
    rawKey: "el_bass_di",
    ch: 1,
    label: "Bass DI",
    note: "Owner-supplied DI box",
    group: "bass",
    ownerRole: "bass",
    ownerMusicianId: "m1",
    slotKey: "bass:0",
    state: "active",
    labelIsCanonical: false,
  };
  const noop = () => undefined;

  it("shows NO CHANNEL SELECTED when nothing is selected", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={null}
        ownerName=""
        channelCount={0}
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

    expect(html).toContain("NO CHANNEL SELECTED");
  });

  it("shows SELECTED CHANNEL with editable fields and the owner block", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={editableRow}
        ownerName="Matěj Novák"
        channelCount={3}
        deviationCount={1}
        canSaveAsMusicianDefault={true}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    expect(html).toContain("SELECTED CHANNEL");
    expect(html).toContain("Bass DI");
    expect(html).toContain("Matěj Novák");
    expect(html).toContain("BASS");
    // Editable: the label/note inputs are present, not read-only text.
    expect(html).toMatch(/<input[^>]*value="Bass DI"/);
    expect(html).toMatch(/<input[^>]*value="Owner-supplied DI box"/);
    expect(html).not.toContain("Not editable");
  });

  it("offers a live Save as musician default button when it can promote something", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={editableRow}
        ownerName="Matěj Novák"
        channelCount={3}
        deviationCount={1}
        canSaveAsMusicianDefault={true}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    const saveDefaultButtonHtml = html
      .split("<button")
      .find((chunk) => chunk.includes("Save as musician default"));
    expect(saveDefaultButtonHtml).toBeDefined();
    expect(saveDefaultButtonHtml).not.toContain("disabled");
  });

  it("disables Save as musician default when the effective preset already equals the musician default", () => {
    // A no-op override: `deviationCount` is still 1 (the patch has an entry),
    // but the page-level `canSaveAsMusicianDefault` compares resolved values,
    // not patch shape — this is what the button must key off of.
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={editableRow}
        ownerName="Matěj Novák"
        channelCount={3}
        deviationCount={1}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
      />,
    );

    const saveDefaultButtonHtml = html
      .split("<button")
      .find((chunk) => chunk.includes("Save as musician default"));
    expect(saveDefaultButtonHtml).toBeDefined();
    expect(saveDefaultButtonHtml).toContain("disabled");
  });

  it("does not offer editing when the owner has no lineup slot", () => {
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={{ ...editableRow, slotKey: "" }}
        ownerName="Matěj Novák"
        channelCount={3}
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

    expect(html).toContain("Not editable");
    expect(html).not.toMatch(/<input/);
    // No slot to act on, so the owner actions do not render either.
    expect(html).not.toContain("Reset to default");
    expect(html).not.toContain("Save as musician default");
  });

  it("has no owner block for a filler row", () => {
    const fillerRow: InputEditorRow = {
      ...editableRow,
      ownerRole: "bass",
      ownerMusicianId: "",
      slotKey: "",
      state: "filler",
    };
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={fillerRow}
        ownerName=""
        channelCount={0}
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

    expect(html).not.toContain("CHANNELS");
    expect(html).not.toContain("DEVIATIONS");
    expect(html).not.toContain("Save as musician default");
  });
});

describe("InputTable (the INPUT LIST section's channel table)", () => {
  it("keeps a disabled row in place, with no channel number", () => {
    const rows: InputEditorRow[] = [
      {
        key: "el_bass_di",
        rawKey: "el_bass_di",
        ch: 1,
        label: "Bass DI",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        state: "active",
        labelIsCanonical: false,
      },
      {
        key: "el_bass_mic",
        rawKey: "el_bass_mic",
        ch: null,
        label: "Bass mic",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        state: "removed",
        labelIsCanonical: false,
      },
    ];

    const html = renderToStaticMarkup(
      <InputTable
        rows={rows}
        selectedKey={null}
        onSelect={() => undefined}
        onReorder={() => undefined}
      />,
    );

    const removedRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Bass mic"));
    expect(removedRowHtml).toContain("inputRow--removed");
    expect(removedRowHtml).toContain("——");
    expect(removedRowHtml).not.toMatch(/inputRow__no">\d/);

    const activeRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Bass DI"));
    expect(activeRowHtml).not.toContain("inputRow--removed");
    expect(activeRowHtml).toContain('inputRow__no">1<');
  });

  it("only makes active rows draggable (R8, Task 14)", () => {
    const rows: InputEditorRow[] = [
      {
        key: "el_bass_di",
        rawKey: "el_bass_di",
        ch: 1,
        label: "Bass DI",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        state: "active",
        labelIsCanonical: false,
      },
      {
        key: "el_bass_mic",
        rawKey: "el_bass_mic",
        ch: null,
        label: "Bass mic",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        state: "removed",
        labelIsCanonical: false,
      },
      {
        key: "spare_ch_1",
        rawKey: "spare_ch_1",
        ch: 3,
        label: "Spare",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "",
        slotKey: "",
        state: "filler",
        labelIsCanonical: false,
      },
    ];

    const html = renderToStaticMarkup(
      <InputTable
        rows={rows}
        selectedKey={null}
        onSelect={() => undefined}
        onReorder={() => undefined}
      />,
    );

    const activeRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Bass DI"));
    const removedRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Bass mic"));
    const fillerRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Spare"));

    expect(activeRowHtml).toContain('draggable="true"');
    expect(removedRowHtml).toContain('draggable="false"');
    expect(fillerRowHtml).toContain('draggable="false"');
  });
});
