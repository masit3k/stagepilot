import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  Monitor,
  MusicianSetupPreset,
} from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import { ToastProvider } from "../../components/ui/toast/ToastProvider";
import { InputRowInspector } from "../components/inputs/InputRowInspector";
import { InputTable } from "../components/inputs/InputTable";
import { MonitorRowInspector } from "../components/inputs/MonitorRowInspector";
import {
  type MonitorEditorRow,
  MonitorTable,
} from "../components/inputs/MonitorTable";
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

  it("renders the MONITORS table header before any project data loads (R7)", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <ProjectInputsPage
          id="p1"
          navigate={() => undefined}
          registerNavigationGuard={() => () => undefined}
        />
      </ToastProvider>,
    );

    expect(html).toContain("monitor output");
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
        onEditKit={noop}
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
        onEditKit={noop}
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
        onEditKit={noop}
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
        onEditKit={noop}
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
        onEditKit={noop}
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
        onEditKit={noop}
      />,
    );

    expect(html).not.toContain("CHANNELS");
    expect(html).not.toContain("DEVIATIONS");
    expect(html).not.toContain("Save as musician default");
  });

  // Task 16: `Edit kit` writes `lineup.drums[i].drumDefinition`, which the
  // document does read (unlike Remove/Restore, task 13b) — so it stays
  // enabled even on a drums row, and its hint replaces the old two-message
  // pairing ("Edit kit [Coming soon]" + a separate Remove/Restore notice)
  // with a single sentence.
  it("offers an enabled Edit kit action for a drums row, with one unified hint instead of Remove/Restore", () => {
    const drumsRow: InputEditorRow = {
      ...editableRow,
      key: "kick_in",
      rawKey: "kick_in",
      label: "Kick in",
      group: "drums",
      ownerRole: "drums",
      ownerMusicianId: "m2",
      slotKey: "drums:0",
    };
    const html = renderToStaticMarkup(
      <InputRowInspector
        row={drumsRow}
        ownerName="Filip Arnold"
        channelCount={4}
        deviationCount={0}
        canSaveAsMusicianDefault={false}
        onLabelChange={noop}
        onNoteChange={noop}
        onResetToDefault={noop}
        onSaveAsMusicianDefault={noop}
        onRemoveChannel={noop}
        onRestoreChannel={noop}
        onEditKit={noop}
      />,
    );

    const editKitButtonHtml = html
      .split("<button")
      .find((chunk) => chunk.includes("Edit kit"));
    expect(editKitButtonHtml).toBeDefined();
    expect(editKitButtonHtml).not.toContain("disabled");
    expect(editKitButtonHtml).not.toContain("Coming soon");

    expect(html).not.toContain("Remove channel");
    expect(html).not.toContain("Restore channel");
    expect(html).toContain("Drum kit channels change through Edit kit");
    expect(html).not.toContain("isn't picked up by the printed document yet");
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

describe("MonitorTable (the MONITORS section's table, R7)", () => {
  const bassRow: MonitorEditorRow = {
    no: "1",
    output: "Bass",
    note: "IEM mono wired (own)",
    ownerRole: "bass",
    ownerMusicianId: "m1",
    slotKey: "bass:0",
  };
  const drumsRow: MonitorEditorRow = {
    no: "2",
    output: "Drums",
    note: "IEM mono wired (own)",
    ownerRole: "drums",
    ownerMusicianId: "m2",
    slotKey: "drums:0",
  };

  it("renders the same header columns as the printed monitor table", () => {
    const html = renderToStaticMarkup(
      <MonitorTable
        rows={[]}
        selectedSlotKey={null}
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain("no.");
    expect(html).toContain("monitor output");
    expect(html).toContain("note");
  });

  it("makes every owned row selectable, including the drums row", () => {
    const html = renderToStaticMarkup(
      <MonitorTable
        rows={[bassRow, drumsRow]}
        selectedSlotKey={null}
        onSelect={() => undefined}
      />,
    );

    const bassRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Bass"));
    const drumsRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Drums"));
    expect(bassRowHtml).toContain('role="button"');
    expect(drumsRowHtml).toContain('role="button"');
  });

  it("does not let a row with no lineup slot be selected", () => {
    const noSlotRow: MonitorEditorRow = { ...bassRow, slotKey: "" };
    const html = renderToStaticMarkup(
      <MonitorTable
        rows={[noSlotRow]}
        selectedSlotKey={null}
        onSelect={() => undefined}
      />,
    );

    const rowHtml = html.split("<div").find((chunk) => chunk.includes("Bass"));
    expect(rowHtml).not.toContain('role="button"');
  });

  it("marks the selected slot's row", () => {
    const html = renderToStaticMarkup(
      <MonitorTable
        rows={[bassRow, drumsRow]}
        selectedSlotKey="drums:0"
        onSelect={() => undefined}
      />,
    );

    const drumsRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Drums"));
    const bassRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Bass"));
    expect(drumsRowHtml).toContain("inputRow--selected");
    expect(bassRowHtml).not.toContain("inputRow--selected");
  });
});

describe("MonitorRowInspector (the panel for the selected monitor, R7)", () => {
  const monitors: Monitor[] = [
    {
      type: "monitor",
      id: "wedge_foh",
      label: "Wedge",
      kind: "wedge",
      supplier: "foh",
    },
    {
      type: "monitor",
      id: "iem_mono_wired_own",
      label: "IEM mono wired",
      kind: "iem",
      supplier: "band",
      mode: "mono",
      wireless: false,
    },
  ];
  const effectiveMonitoring: MusicianSetupPreset["monitoring"] = {
    monitorRef: "iem_mono_wired_own",
  };
  const diffMeta: SetupDiffMeta = {
    inputs: [],
    monitoring: {
      monitorRef: { origin: "default", changeType: "unchanged" },
      additionalWedgeCount: { origin: "default", changeType: "unchanged" },
    },
  };
  const bassRow: MonitorEditorRow = {
    no: "1",
    output: "Bass",
    note: "IEM mono wired (own)",
    ownerRole: "bass",
    ownerMusicianId: "m1",
    slotKey: "bass:0",
  };
  const drumsRow: MonitorEditorRow = {
    no: "2",
    output: "Drums",
    note: "IEM mono wired (own)",
    ownerRole: "drums",
    ownerMusicianId: "m2",
    slotKey: "drums:0",
  };
  const noop = () => undefined;

  it("shows NO MONITOR SELECTED when nothing is selected", () => {
    const html = renderToStaticMarkup(
      <MonitorRowInspector
        row={null}
        ownerName=""
        monitors={monitors}
        effectiveMonitoring={null}
        diffMeta={null}
        patch={undefined}
        onChangePatch={noop}
      />,
    );

    expect(html).toContain("NO MONITOR SELECTED");
  });

  it("offers the monitoring editor for a bass/guitar/keys/vocs slot", () => {
    const html = renderToStaticMarkup(
      <MonitorRowInspector
        row={bassRow}
        ownerName="Matěj Novák"
        monitors={monitors}
        effectiveMonitoring={effectiveMonitoring}
        diffMeta={diffMeta}
        patch={undefined}
        onChangePatch={noop}
      />,
    );

    expect(html).toContain("SELECTED MONITOR");
    expect(html).toContain("Matěj Novák");
    // The monitoring editor's own controls are present (select + supplier switch).
    expect(html).toMatch(/<select/);
    expect(html).not.toContain("not editable");
  });

  // Ruling (task 15): the document ignores a drums slot's monitoring patch
  // (`resolveEffectiveProjectSetup.ts:81-90`, task 12c fix round 1) — the
  // panel must not offer an edit that silently gets discarded.
  it("disables editing for a drums slot and explains why, instead of offering a silently-dropped edit", () => {
    const html = renderToStaticMarkup(
      <MonitorRowInspector
        row={drumsRow}
        ownerName="Filip Arnold"
        monitors={monitors}
        effectiveMonitoring={effectiveMonitoring}
        diffMeta={diffMeta}
        patch={undefined}
        onChangePatch={noop}
      />,
    );

    expect(html).toContain("SELECTED MONITOR");
    expect(html).toContain("not editable here");
    expect(html).not.toMatch(/<select/);
  });

  it("shows a no-slot hint when the owner has no lineup slot", () => {
    const html = renderToStaticMarkup(
      <MonitorRowInspector
        row={{ ...bassRow, slotKey: "" }}
        ownerName="Matěj Novák"
        monitors={monitors}
        effectiveMonitoring={effectiveMonitoring}
        diffMeta={diffMeta}
        patch={undefined}
        onChangePatch={noop}
      />,
    );

    expect(html).toContain("Not editable");
    expect(html).not.toMatch(/<select/);
  });
});
