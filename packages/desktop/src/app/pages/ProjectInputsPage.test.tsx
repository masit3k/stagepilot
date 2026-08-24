import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultDrumDefinition } from "../../../../../src/domain/drums/drumDefinition";
import type {
  Monitor,
  MusicianSetupPreset,
  PresetEntity,
} from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import { ToastProvider } from "../../components/ui/toast/ToastProvider";
import type { LineupMap } from "../../projectRules";
import { InputRowInspector } from "../components/inputs/InputRowInspector";
import { InputTable } from "../components/inputs/InputTable";
import { InputsOverlayActions } from "../components/inputs/InputsOverlayActions";
import { MonitorRowInspector } from "../components/inputs/MonitorRowInspector";
import {
  type MonitorEditorRow,
  MonitorTable,
} from "../components/inputs/MonitorTable";
import type { InputEditorRow } from "../domain/inputs/buildInputEditorRows";
import { resolveInputsOverlayEditorModel } from "../domain/roles/inputsOverlayEditor";
import type { BandSetupData } from "../shell/types";
import {
  ProjectInputsPage,
  buildInputsSavePayload,
  countOwnerDeviations,
  isInputsDirty,
  isReorderNoop,
  replaceSlotDrumDefinition,
  resetSlotToDefault,
} from "./ProjectInputsPage";

describe("isInputsDirty", () => {
  const empty = {
    inputOrder: undefined,
    notes: undefined,
    lineup: {},
    overlays: undefined,
  };

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

  it("carries overlays through the snapshot so an overlay edit survives save", () => {
    const initial = {
      ...empty,
      overlays: { leadVocals: ["m1"], backVocals: [] },
    };
    const changed = {
      ...initial,
      overlays: { leadVocals: [], backVocals: [] },
    };

    expect(isInputsDirty(initial, changed)).toBe(true);
  });

  it("is clean when both snapshots carry the same overlays", () => {
    const overlays = {
      leadVocals: ["m1"],
      backVocals: [],
      talkback: { mode: "assigned" as const, ownerId: "m2" },
    };

    expect(
      isInputsDirty(
        { ...empty, overlays },
        { ...empty, overlays: { ...overlays } },
      ),
    ).toBe(false);
  });
});

/**
 * Nejrizikovější místo Tasku 16: kdyby se overlays nedostaly do payloadu,
 * uživatel by vokalistu přidal, viděl ho v tabulce (ta čte `editedProject`)
 * a po uložení by zmizel. Proto je skládání payloadu jedna exportovaná
 * funkce a proto má vlastní test.
 */
describe("buildInputsSavePayload", () => {
  const project = {
    id: "p1",
    purpose: "event" as const,
    bandRef: "band",
    documentDate: "2026-01-01",
    createdAt: "2026-01-01T00:00:00.000Z",
    lineup: { vocs: [{ musicianId: "old" }] },
    overlays: { leadVocals: ["old"], backVocals: [] },
    inputOrder: ["a"],
  };

  it("takes all four edited layers from the snapshot, not from the project", () => {
    const payload = buildInputsSavePayload(
      {
        inputOrder: ["b"],
        notes: { disabled: ["n1"] },
        lineup: { vocs: [{ musicianId: "new" }] },
        overlays: { leadVocals: ["new"], backVocals: ["other"] },
      },
      project,
    );

    expect(payload.overlays).toEqual({
      leadVocals: ["new"],
      backVocals: ["other"],
    });
    expect(payload.lineup).toEqual({ vocs: [{ musicianId: "new" }] });
    expect(payload.inputOrder).toEqual(["b"]);
    expect(payload.notes).toEqual({ disabled: ["n1"] });
  });

  it("keeps the project's untouched fields", () => {
    const payload = buildInputsSavePayload(
      {
        inputOrder: undefined,
        notes: undefined,
        lineup: {},
        overlays: undefined,
      },
      project,
    );

    expect(payload.id).toBe("p1");
    expect(payload.bandRef).toBe("band");
    // Snapshot bez overlays je stav projektu, který je nikdy neměl — ne
    // pokyn nechat na projektu tu starou hodnotu.
    expect(payload.overlays).toBeUndefined();
  });
});

// Important 2 (review): `onDrop` calls `onReorder` unconditionally
// (`InputTable.tsx:67-71`), even for a drop that lands back on the same
// spot — a row dragged onto itself, or onto a filler/removed neighbor that
// resolves back to the source's own position. R8 forbids writing
// `inputOrder` in that case: a written-but-unchanged order would concrete
// over today's computed order for every project saved from then on, so a
// later change to the domain's ordering rules would never reach it again.
describe("isReorderNoop", () => {
  it("is a noop when the order after the move equals the order before it", () => {
    expect(isReorderNoop(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("is not a noop once the order actually changes", () => {
    expect(isReorderNoop(["b", "a", "c"], ["a", "b", "c"])).toBe(false);
  });
});

// Fix round 2, Minor 2: locks Ruling 1 (task 16) in a test, not just a
// scratchpad script that never lived in the repo. `Edit kit` must write
// *only* `drumDefinition` — a slot's `presetOverride` (rename/note patches
// from R6) has to survive the kit edit completely untouched, or the next
// task to touch this slot inherits a silent regression.
describe("replaceSlotDrumDefinition (Task 16, Ruling 1)", () => {
  it("changes only drumDefinition, leaving an existing presetOverride untouched", () => {
    const nextKit = { ...createDefaultDrumDefinition(), tomCount: 3 as const };
    const lineup = {
      drums: [
        {
          musicianId: "m2",
          presetOverride: {
            inputs: { update: [{ key: "dr_kick_1_out", note: "Beta 52A" }] },
          },
          drumDefinition: createDefaultDrumDefinition(),
        },
      ],
    };

    const next = replaceSlotDrumDefinition(lineup, "drums", 0, nextKit);
    const nextSlot = (next.drums as Array<Record<string, unknown>>)[0];

    expect(nextSlot.drumDefinition).toEqual(nextKit);
    expect(nextSlot.presetOverride).toEqual(lineup.drums[0].presetOverride);
    expect(nextSlot.musicianId).toBe("m2");
  });
});

// Important 3+4 (review): shares its root with Important 3 — a drums slot's
// "deviation" must mean the same thing everywhere it's evaluated.
// `countPatchDeviations` alone never sees `drumDefinition`, since `Edit kit`
// on `02` writes only that field (Task 16, Ruling 1). Without
// `countOwnerDeviations`, the panel reported `DEVIATIONS 0` and disabled
// `Reset to default` for a slot that provably deviated and whose kit change
// the document prints.
describe("countOwnerDeviations (Important 3+4, review)", () => {
  it("counts a kit-only change even with no presetOverride at all", () => {
    expect(countOwnerDeviations(undefined, createDefaultDrumDefinition())).toBe(
      1,
    );
  });

  it("adds the kit deviation on top of the patch's own count", () => {
    const patch = { inputs: { update: [{ key: "dr_kick_1_out", note: "X" }] } };

    expect(countOwnerDeviations(patch, createDefaultDrumDefinition())).toBe(2);
  });

  it("stays at the patch-only count when the slot has no drumDefinition", () => {
    const patch = { inputs: { update: [{ key: "dr_kick_1_out", note: "X" }] } };

    expect(countOwnerDeviations(patch, undefined)).toBe(1);
  });

  it("is zero for an untouched slot", () => {
    expect(countOwnerDeviations(undefined, undefined)).toBe(0);
  });
});

// `resetSlotToDefault` is what `Reset to default` calls on the panel
// (Important 3+4, review) — it must clear `drumDefinition` alongside
// `presetOverride`, or "vrátit kit na default" leaves the kit exactly as
// edited: `resolveEffectiveProjectSetup.ts:50-54` falls back to the
// musician's own preset kit only once `drumDefinition` is gone entirely,
// the same pair of fields `resetInputsScreen.ts` strips for the whole
// lineup at once.
describe("resetSlotToDefault (Important 3+4, review)", () => {
  it("clears both presetOverride and drumDefinition, keeping musicianId", () => {
    const lineup = {
      drums: [
        {
          musicianId: "m2",
          presetOverride: {
            inputs: { update: [{ key: "dr_kick_1_out", note: "Beta 52A" }] },
          },
          drumDefinition: {
            ...createDefaultDrumDefinition(),
            tomCount: 3 as const,
          },
        },
      ],
    };

    const next = resetSlotToDefault(lineup, "drums", 0);

    expect(next.drums).toEqual([{ musicianId: "m2" }]);
  });

  it("leaves other slots of the same role untouched", () => {
    const lineup = {
      bass: [
        { musicianId: "m1", presetOverride: { inputs: { remove: ["x"] } } },
        { musicianId: "m2", presetOverride: { inputs: { remove: ["y"] } } },
      ],
    };

    const next = resetSlotToDefault(lineup, "bass", 1);

    expect(next.bass).toEqual([
      { musicianId: "m1", presetOverride: { inputs: { remove: ["x"] } } },
      { musicianId: "m2" },
    ]);
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

describe("InputsOverlayActions (the three overlay actions under INPUT LIST, R7)", () => {
  const PRESETS: Record<string, PresetEntity> = {
    vocal_wireless: {
      type: "preset",
      id: "vocal_wireless",
      label: "Vocal (wireless)",
      group: "vocs",
      capabilities: ["vocal"],
      inputs: [{ key: "voc_input", label: "Vocal" }],
    },
  };
  const setupData: BandSetupData = {
    id: "band",
    name: "Band",
    members: { vocs: [{ id: "voc-1", name: "Vera Vocals" }] },
    musicianPresetsById: {
      "voc-1": [{ kind: "preset", ref: "vocal_wireless" }],
    },
    presetCatalog: PRESETS,
  };

  function renderActions(args: { lineup: LineupMap; disabled: boolean }) {
    const model = resolveInputsOverlayEditorModel({
      setupData,
      presetCatalog: PRESETS,
      lineup: args.lineup,
      overlays: { leadVocals: ["voc-1"], backVocals: [] },
    });
    return renderToStaticMarkup(
      <InputsOverlayActions
        model={model}
        disabled={args.disabled}
        onSaveVocals={() => undefined}
        onSaveTalkback={() => undefined}
      />,
    );
  }

  function disabledButtonLabels(html: string): string[] {
    return html
      .split("<button")
      .filter((chunk) => chunk.includes("disabled"))
      .map((chunk) =>
        chunk
          .slice(chunk.indexOf(">") + 1)
          .split("<")[0]
          .trim(),
      );
  }

  const staffed: LineupMap = { vocs: [{ musicianId: "voc-1" }] };

  it("offers exactly the three overlay actions and no channel-adding action", () => {
    const html = renderActions({ lineup: staffed, disabled: false });

    expect(html).toContain("Lead vocals");
    expect(html).toContain("Back vocals");
    expect(html).toContain("Talkback");
    // R5: kanál se na `02` přidává přes `Edit inputs` a `Edit kit`, ne sem.
    expect(html).not.toContain("Add input");
  });

  it("keeps every action live once the lineup has someone to offer", () => {
    expect(
      disabledButtonLabels(renderActions({ lineup: staffed, disabled: false })),
    ).toEqual([]);
  });

  it("disables all three while the project is still loading", () => {
    expect(
      disabledButtonLabels(renderActions({ lineup: staffed, disabled: true })),
    ).toEqual(["Lead vocals", "Back vocals", "Talkback"]);
  });

  it("disables only Talkback when nobody is in the lineup yet", () => {
    // Vokální kandidáti chodí i z katalogu kapely (Task 15), takže ty dvě
    // akce zůstávají živé. Talkback ale musí být v sestavě, jinak ho
    // `resolveProjectTalkbackState` zahodí — nabízet ho nemá koho.
    expect(
      disabledButtonLabels(renderActions({ lineup: {}, disabled: false })),
    ).toEqual(["Talkback"]);
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
        onEditInputs={noop}
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
        onEditInputs={noop}
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
        onEditInputs={noop}
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
        onEditInputs={noop}
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
        onEditInputs={noop}
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
        onEditInputs={noop}
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
        onEditInputs={noop}
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

  // F5d R3: the document now reads a drums slot's monitoring override
  // (`resolveEffectiveProjectSetup`) and rejects an invalid `monitorRef` just
  // like it does on bass, so the gate fell and the panel offers the edit. The
  // contract against the document itself lives in
  // `domain/inputs/uiDocumentContract.test.ts`.
  it("offers the monitoring editor for a drums slot too (F5d R3)", () => {
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
    expect(html).toMatch(/<select/);
    expect(html).not.toContain("not editable");
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
