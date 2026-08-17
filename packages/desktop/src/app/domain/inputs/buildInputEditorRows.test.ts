import { describe, expect, it } from "vitest";
import type { DocumentViewModel } from "../../../../../../src/domain/model/types";
import {
  type DisabledInputRow,
  type SetupForSlot,
  buildInputEditorRows,
  collectDisabledInputRows,
} from "./buildInputEditorRows";

type DocInput = DocumentViewModel["inputs"][number];

/** One printed row of `document.inputs`. `group`/`ownerRole` default to "bass" — override for other roles. */
function row(
  overrides: Partial<DocInput> & Pick<DocInput, "ch" | "key" | "label">,
): DocInput {
  return { group: "bass", ownerRole: "bass", note: "", ...overrides };
}

/**
 * `buildInputEditorRows` only ever reads `document.inputs`; the rest of
 * `DocumentViewModel` (header, monitors, notes, stageplan...) is irrelevant
 * to the join this module performs, so tests only fill in the slice that
 * matters instead of constructing a full view model by hand.
 */
function makeDocument(inputs: DocInput[]): DocumentViewModel {
  return { inputs } as unknown as DocumentViewModel;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("buildInputEditorRows", () => {
  it("copies active rows from the document with the same numbers and order", () => {
    const document = makeDocument([
      row({ ch: 1, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
      row({
        ch: 2,
        key: "bass_amp",
        label: "Bass amp mic",
        ownerMusicianId: "m1",
      }),
    ]);

    const rows = buildInputEditorRows({ document, disabledRows: [] });

    expect(rows.map((r) => [r.key, r.ch])).toEqual([
      ["bass_di", 1],
      ["bass_amp", 2],
    ]);
    expect(rows.every((r) => r.state === "active")).toBe(true);
  });

  it("marks a spare_ch_ key as a filler row", () => {
    const document = makeDocument([
      row({
        ch: 1,
        key: "keys_l",
        label: "Keys L",
        group: "keys",
        ownerRole: "keys",
        ownerMusicianId: "m2",
      }),
      row({
        ch: 2,
        key: "spare_ch_2",
        label: "---",
        note: "---",
        group: "keys",
        ownerRole: "keys",
      }),
      row({
        ch: 3,
        key: "keys_r",
        label: "Keys R",
        group: "keys",
        ownerRole: "keys",
        ownerMusicianId: "m2",
      }),
    ]);

    const rows = buildInputEditorRows({ document, disabledRows: [] });

    const filler = rows.find((r) => r.key === "spare_ch_2");
    expect(filler?.state).toBe("filler");
    expect(filler?.ch).toBe(2);
  });

  it("inserts a disabled row after its neighbor without shifting the printed numbers", () => {
    const document = makeDocument([
      row({ ch: 1, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
      row({
        ch: 2,
        key: "bass_amp",
        label: "Bass amp mic",
        ownerMusicianId: "m1",
      }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        key: "bass_mic",
        label: "Bass mic",
        note: "",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: "bass_di",
      },
    ];

    const rows = buildInputEditorRows({ document, disabledRows });

    expect(rows.map((r) => r.key)).toEqual(["bass_di", "bass_mic", "bass_amp"]);
    const disabled = rows.find((r) => r.key === "bass_mic");
    expect(disabled?.ch).toBeNull();
    expect(disabled?.state).toBe("removed");
    expect(rows.find((r) => r.key === "bass_di")?.ch).toBe(1);
    expect(rows.find((r) => r.key === "bass_amp")?.ch).toBe(2);
  });

  it("places a disabled row with no known neighbor at the end of its own group, not inside another one", () => {
    const document = makeDocument([
      row({ ch: 1, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
      row({
        ch: 2,
        key: "guitar_di",
        label: "Guitar DI",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
      }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        key: "bass_mic",
        label: "Bass mic",
        note: "",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({ document, disabledRows });

    expect(rows.map((r) => r.key)).toEqual([
      "bass_di",
      "bass_mic",
      "guitar_di",
    ]);
  });

  it("anchors an orphaned disabled row on its own musician, not a labelmate's, when a role has two", () => {
    const document = makeDocument([
      row({
        ch: 1,
        key: "guitar1_di",
        label: "Guitar 1",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
      }),
      row({
        ch: 2,
        key: "guitar2_di",
        label: "Guitar 2",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
      }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        key: "guitar1_mic",
        label: "Guitar 1 mic",
        note: "",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
        slotKey: "guitar:0",
        neighborKey: null,
      },
      {
        key: "guitar2_mic",
        label: "Guitar 2 mic",
        note: "",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
        slotKey: "guitar:1",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({ document, disabledRows });

    expect(rows.map((r) => r.key)).toEqual([
      "guitar1_di",
      "guitar1_mic",
      "guitar2_di",
      "guitar2_mic",
    ]);
  });

  it("matches the document exactly when there are no disabled rows", () => {
    const inputs = [
      row({ ch: 1, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
      row({
        ch: 2,
        key: "bass_amp",
        label: "Bass amp mic",
        ownerMusicianId: "m1",
      }),
    ];
    const document = makeDocument(inputs);

    const rows = buildInputEditorRows({ document, disabledRows: [] });

    expect(
      rows.map((r) => ({
        key: r.key,
        ch: r.ch,
        label: r.label,
        group: r.group,
        ownerRole: r.ownerRole,
        ownerMusicianId: r.ownerMusicianId,
        state: r.state,
      })),
    ).toEqual(
      inputs.map((i) => ({
        key: i.key,
        ch: i.ch,
        label: i.label,
        group: i.group,
        ownerRole: i.ownerRole,
        ownerMusicianId: i.ownerMusicianId,
        state: "active",
      })),
    );
  });

  it("does not mutate the document's inputs or the disabled rows it receives", () => {
    const inputs = [
      row({ ch: 1, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
      row({
        ch: 2,
        key: "bass_amp",
        label: "Bass amp mic",
        ownerMusicianId: "m1",
      }),
    ];
    const disabledRows: DisabledInputRow[] = [
      {
        key: "bass_mic",
        label: "Bass mic",
        note: "",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: "bass_di",
      },
    ];
    const inputsBefore = clone(inputs);
    const disabledRowsBefore = clone(disabledRows);

    buildInputEditorRows({ document: makeDocument(inputs), disabledRows });

    expect(inputs).toEqual(inputsBefore);
    expect(disabledRows).toEqual(disabledRowsBefore);
  });

  it("derives slotKey from ownerRole and the order the owner's rows first appear", () => {
    const document = makeDocument([
      row({
        ch: 1,
        key: "guitar1_di",
        label: "Guitar 1",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
      }),
      row({
        ch: 2,
        key: "guitar2_di",
        label: "Guitar 2",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
      }),
      row({
        ch: 3,
        key: "guitar1_mic",
        label: "Guitar 1 mic",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
      }),
    ]);

    const rows = buildInputEditorRows({ document, disabledRows: [] });

    expect(rows.find((r) => r.key === "guitar1_di")?.slotKey).toBe("guitar:0");
    expect(rows.find((r) => r.key === "guitar2_di")?.slotKey).toBe("guitar:1");
    expect(rows.find((r) => r.key === "guitar1_mic")?.slotKey).toBe("guitar:0");
  });
});

type InputDefLike = { key: string; label: string; note?: string };

function stubSetup(args: {
  defaults: InputDefLike[];
  effective: InputDefLike[];
}): SetupForSlot {
  return () =>
    ({
      resolved: { defaultPreset: { inputs: args.defaults, monitoring: {} } },
      effective: { inputs: args.effective, monitoring: {} },
    }) as never;
}

describe("collectDisabledInputRows", () => {
  it("reports a key disabled by a patch, with its owner", () => {
    const setupForSlot = stubSetup({
      defaults: [
        { key: "bass_di", label: "Bass DI" },
        { key: "bass_mic", label: "Bass mic" },
      ],
      effective: [{ key: "bass_di", label: "Bass DI" }],
    });

    const rows = collectDisabledInputRows({
      lineup: { bass: [{ musicianId: "m1" }] },
      roleOrder: ["bass"],
      setupForSlot,
    });

    expect(rows).toEqual([
      {
        key: "bass_mic",
        label: "Bass mic",
        note: "",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: "bass_di",
      },
    ]);
  });

  it("still finds a disabled channel when the lineup is written as an array of musician-id strings (regression)", () => {
    const setupForSlot = stubSetup({
      defaults: [
        { key: "bass_di", label: "Bass DI" },
        { key: "bass_mic", label: "Bass mic" },
      ],
      effective: [{ key: "bass_di", label: "Bass DI" }],
    });

    const rows = collectDisabledInputRows({
      lineup: { bass: ["m1"] },
      roleOrder: ["bass"],
      setupForSlot,
    });

    expect(rows.map((r) => r.key)).toEqual(["bass_mic"]);
  });

  it("skips a slot with no musician", () => {
    let calls = 0;
    const setupForSlot: SetupForSlot = () => {
      calls++;
      return {
        resolved: { defaultPreset: { inputs: [], monitoring: {} } },
        effective: { inputs: [], monitoring: {} },
      } as never;
    };

    const rows = collectDisabledInputRows({
      lineup: { bass: [{ musicianId: "" }] },
      roleOrder: ["bass"],
      setupForSlot,
    });

    expect(rows).toEqual([]);
    expect(calls).toBe(0);
  });

  it("does not report a channel the project added as disabled", () => {
    const setupForSlot = stubSetup({
      defaults: [{ key: "bass_di", label: "Bass DI" }],
      effective: [
        { key: "bass_di", label: "Bass DI" },
        { key: "extra", label: "Extra" },
      ],
    });

    const rows = collectDisabledInputRows({
      lineup: { bass: [{ musicianId: "m1" }] },
      roleOrder: ["bass"],
      setupForSlot,
    });

    expect(rows).toEqual([]);
  });
});
