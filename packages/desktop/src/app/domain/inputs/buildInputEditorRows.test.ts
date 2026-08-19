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
  return { group: "bass", ownerRole: "bass", note: "", labelIsCanonical: false, ...overrides };
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

/** `${role}:${musicianId}` -> `${role}:${index}`, the shape `buildSlotKeyIndex` produces. */
function ownerSlotKeys(
  pairs: Record<string, string>,
): ReadonlyMap<string, string> {
  return new Map(Object.entries(pairs));
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

    const rows = buildInputEditorRows({
      document,
      disabledRows: [],
      slotKeysByOwner: ownerSlotKeys({ "bass:m1": "bass:0" }),
    });

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

    const rows = buildInputEditorRows({
      document,
      disabledRows: [],
      slotKeysByOwner: ownerSlotKeys({ "keys:m2": "keys:0" }),
    });

    const filler = rows.find((r) => r.key === "spare_ch_2");
    expect(filler?.state).toBe("filler");
    expect(filler?.ch).toBe(2);
  });

  it("carries the document key as rawKey on an active row", () => {
    const document = makeDocument([
      row({ ch: 1, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
    ]);

    const rows = buildInputEditorRows({
      document,
      disabledRows: [],
      slotKeysByOwner: ownerSlotKeys({ "bass:m1": "bass:0" }),
    });

    expect(rows[0].rawKey).toBe("bass_di");
    expect(rows[0].rawKey).toBe(rows[0].key);
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
        rawKey: "bass_mic",
        label: "Bass mic",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: "bass_di",
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({ "bass:m1": "bass:0" }),
    });

    expect(rows.map((r) => r.label)).toEqual([
      "Bass DI",
      "Bass mic",
      "Bass amp mic",
    ]);
    const disabled = rows.find((r) => r.label === "Bass mic");
    expect(disabled?.ch).toBeNull();
    expect(disabled?.state).toBe("removed");
    expect(rows.find((r) => r.label === "Bass DI")?.ch).toBe(1);
    expect(rows.find((r) => r.label === "Bass amp mic")?.ch).toBe(2);
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
        rawKey: "bass_mic",
        label: "Bass mic",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({
        "bass:m1": "bass:0",
        "guitar:m2": "guitar:0",
      }),
    });

    expect(rows.map((r) => r.label)).toEqual([
      "Bass DI",
      "Bass mic",
      "Guitar DI",
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
        rawKey: "guitar1_mic",
        label: "Guitar 1 mic",
        note: "",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
        slotKey: "guitar:0",
        neighborKey: null,
      },
      {
        rawKey: "guitar2_mic",
        label: "Guitar 2 mic",
        note: "",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
        slotKey: "guitar:1",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({
        "guitar:m1": "guitar:0",
        "guitar:m2": "guitar:1",
      }),
    });

    expect(rows.map((r) => r.label)).toEqual([
      "Guitar 1",
      "Guitar 1 mic",
      "Guitar 2",
      "Guitar 2 mic",
    ]);
  });

  it("matches the document exactly when there are no disabled rows", () => {
    const inputs = [
      row({
        ch: 1,
        key: "bass_di",
        label: "Bass DI",
        note: "DI box",
        ownerMusicianId: "m1",
      }),
      row({
        ch: 2,
        key: "bass_amp",
        label: "Bass amp mic",
        ownerMusicianId: "m1",
      }),
    ];
    const document = makeDocument(inputs);

    const rows = buildInputEditorRows({
      document,
      disabledRows: [],
      slotKeysByOwner: ownerSlotKeys({ "bass:m1": "bass:0" }),
    });

    expect(
      rows.map((r) => ({
        key: r.key,
        ch: r.ch,
        label: r.label,
        note: r.note,
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
        note: i.note ?? "",
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
        rawKey: "bass_mic",
        label: "Bass mic",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: "bass_di",
      },
    ];
    const inputsBefore = clone(inputs);
    const disabledRowsBefore = clone(disabledRows);

    buildInputEditorRows({
      document: makeDocument(inputs),
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({ "bass:m1": "bass:0" }),
    });

    expect(inputs).toEqual(inputsBefore);
    expect(disabledRows).toEqual(disabledRowsBefore);
  });

  it("keys an active row by owner identity from the supplied map, not by the order rows print in", () => {
    // Mirrors the real bug: `comparePdfInputs` sorts acoustic guitars after
    // electric ones, ahead of the lineup tie-break, so the second guitarist's
    // row can print before the first's. `slotKey` must still point at each
    // musician's real lineup slot, not at the print position.
    const document = makeDocument([
      row({
        ch: 1,
        key: "el_guitar_2",
        label: "Electric guitar 2",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
      }),
      row({
        ch: 2,
        key: "ac_guitar_1",
        label: "Acoustic guitar 1",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
      }),
    ]);

    const rows = buildInputEditorRows({
      document,
      disabledRows: [],
      slotKeysByOwner: ownerSlotKeys({
        "guitar:m1": "guitar:0",
        "guitar:m2": "guitar:1",
      }),
    });

    expect(rows.find((r) => r.key === "ac_guitar_1")?.slotKey).toBe("guitar:0");
    expect(rows.find((r) => r.key === "el_guitar_2")?.slotKey).toBe("guitar:1");
  });

  it("leaves slotKey empty when the row's owner isn't in the supplied map", () => {
    const document = makeDocument([
      row({ ch: 1, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
    ]);

    const rows = buildInputEditorRows({
      document,
      disabledRows: [],
      slotKeysByOwner: new Map(),
    });

    expect(rows[0].slotKey).toBe("");
  });

  it("keeps two consecutive disabled channels of the same musician in their relative order", () => {
    const document = makeDocument([
      row({ ch: 1, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        rawKey: "bass_mic",
        label: "Bass mic",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: "bass_di",
      },
      {
        rawKey: "bass_pedal",
        label: "Bass pedal",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: "bass_mic",
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({ "bass:m1": "bass:0" }),
    });

    expect(rows.map((r) => r.label)).toEqual([
      "Bass DI",
      "Bass mic",
      "Bass pedal",
    ]);
  });

  it("falls back to the end of the ownerRole block when the owner has no rows of its own yet", () => {
    const document = makeDocument([
      row({
        ch: 1,
        key: "bass_di",
        label: "Bass DI (m2)",
        ownerMusicianId: "m2",
      }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        rawKey: "bass_mic",
        label: "Bass mic (m1)",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({
        "bass:m1": "bass:0",
        "bass:m2": "bass:1",
      }),
    });

    expect(rows.map((r) => r.label)).toEqual(["Bass DI (m2)", "Bass mic (m1)"]);
  });

  it("keeps a disabled row's identity distinct from an active row that happens to share its raw key", () => {
    // Only one instance of "el_guitar" prints (guitarist 1's is disabled), so
    // `disambiguateInputKeys` leaves it bare — it belongs to guitarist 2.
    const document = makeDocument([
      row({
        ch: 1,
        key: "el_guitar",
        label: "Electric guitar 2",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
      }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        rawKey: "el_guitar",
        label: "Electric guitar",
        note: "",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
        slotKey: "guitar:0",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({
        "guitar:m1": "guitar:0",
        "guitar:m2": "guitar:1",
      }),
    });

    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(rows.find((r) => r.ownerMusicianId === "m1")?.key).not.toBe(
      rows.find((r) => r.ownerMusicianId === "m2")?.key,
    );
  });

  it("carries the bare channel key in rawKey on a disabled row while key stays namespaced by owner", () => {
    const document = makeDocument([
      row({
        ch: 1,
        key: "el_guitar",
        label: "Electric guitar 2",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
      }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        rawKey: "el_guitar",
        label: "Electric guitar",
        note: "",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
        slotKey: "guitar:0",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({
        "guitar:m1": "guitar:0",
        "guitar:m2": "guitar:1",
      }),
    });

    const removed = rows.find((r) => r.state === "removed");
    expect(removed?.rawKey).toBe("el_guitar");
    expect(removed?.key).toBe("m1:el_guitar");
    expect(removed?.key).not.toBe(removed?.rawKey);
  });

  it("does not let a same-named active row from a different musician satisfy the neighbor lookup", () => {
    const document = makeDocument([
      row({
        ch: 1,
        key: "el_guitar_mic",
        label: "Guitar 2 mic",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
      }),
      row({
        ch: 2,
        key: "el_guitar",
        label: "Guitar 2",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m2",
      }),
    ]);
    // Guitarist 1 has the identical preset, both channels disabled. Its
    // `el_guitar`'s neighbor is `el_guitar_mic` — a raw key guitarist 2 also
    // uses. The lookup must not lock onto guitarist 2's printed row.
    const disabledRows: DisabledInputRow[] = [
      {
        rawKey: "el_guitar_mic",
        label: "Guitar 1 mic",
        note: "",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
        slotKey: "guitar:0",
        neighborKey: null,
      },
      {
        rawKey: "el_guitar",
        label: "Guitar 1",
        note: "",
        group: "guitar",
        ownerRole: "guitar",
        ownerMusicianId: "m1",
        slotKey: "guitar:0",
        neighborKey: "el_guitar_mic",
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({
        "guitar:m1": "guitar:0",
        "guitar:m2": "guitar:1",
      }),
    });

    expect(rows.map((r) => r.label)).toEqual([
      "Guitar 2 mic",
      "Guitar 2",
      "Guitar 1 mic",
      "Guitar 1",
    ]);
  });

  it("copies labelIsCanonical from the document onto an active row, never recomputing it (task 12c)", () => {
    const document = makeDocument([
      row({
        ch: 1,
        key: "dr_kick_1_out",
        label: "Kick OUT",
        group: "drums",
        ownerRole: "drums",
        ownerMusicianId: "dr1",
        labelIsCanonical: true,
      }),
      row({
        ch: 2,
        key: "voc_lead_1",
        label: "Lead vocal",
        group: "vocs",
        ownerRole: "vocs",
        ownerMusicianId: "voc1",
        labelIsCanonical: true,
      }),
      row({ ch: 3, key: "bass_di", label: "Bass DI", ownerMusicianId: "m1" }),
    ]);

    const rows = buildInputEditorRows({
      document,
      disabledRows: [],
      slotKeysByOwner: ownerSlotKeys({
        "drums:dr1": "drums:0",
        "vocs:voc1": "vocs:0",
        "bass:m1": "bass:0",
      }),
    });

    expect(rows.find((r) => r.key === "dr_kick_1_out")?.labelIsCanonical).toBe(true);
    expect(rows.find((r) => r.key === "voc_lead_1")?.labelIsCanonical).toBe(true);
    expect(rows.find((r) => r.key === "bass_di")?.labelIsCanonical).toBe(false);
  });

  it("computes labelIsCanonical for a disabled row from its raw key, since disabled rows never went through the document's own recompute (task 12c)", () => {
    const document = makeDocument([
      row({ ch: 1, key: "dr_hihat", label: "Hi-hat", group: "drums", ownerRole: "drums", ownerMusicianId: "dr1" }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        rawKey: "dr_kick_1_out",
        label: "Kick OUT",
        note: "",
        group: "drums",
        ownerRole: "drums",
        ownerMusicianId: "dr1",
        slotKey: "drums:0",
        neighborKey: null,
      },
      {
        rawKey: "bass_mic",
        label: "Bass mic",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({ "drums:dr1": "drums:0", "bass:m1": "bass:0" }),
    });

    expect(rows.find((r) => r.rawKey === "dr_kick_1_out")?.labelIsCanonical).toBe(true);
    expect(rows.find((r) => r.rawKey === "bass_mic")?.labelIsCanonical).toBe(false);
  });

  it("marks a disabled vocs-capability row canonical, since re-enabling it prints as a recomputed voc_lead_N/voc_back_N row (fix round 1, Minor 6)", () => {
    // `collectDisabledInputRows` carries the disabled channel's own group
    // (see that describe block below) — a vocal capability disabled off a
    // guitarist's slot reports `group: "vocs"` even though the owner's role
    // is "guitar". Re-enabling it doesn't print under its own raw key: it
    // feeds `vocalCapabilityByMusicianId` and comes back out as a
    // `voc_lead_N`/`voc_back_N` overlay row, whose label
    // `formatLeadVocalPdfLabel`/`formatBackVocalPdfLabel` always recomputes.
    // A rename offered on the still-disabled row could never print once it's
    // turned back on, so it must already read as canonical.
    const document = makeDocument([
      row({ ch: 1, key: "el_guitar", label: "Electric guitar", group: "guitar", ownerRole: "guitar", ownerMusicianId: "gtr1" }),
    ]);
    const disabledRows: DisabledInputRow[] = [
      {
        rawKey: "voc_cap_no_mic",
        label: "Back vocal capability",
        note: "",
        group: "vocs",
        ownerRole: "guitar",
        ownerMusicianId: "gtr1",
        slotKey: "guitar:0",
        neighborKey: null,
      },
    ];

    const rows = buildInputEditorRows({
      document,
      disabledRows,
      slotKeysByOwner: ownerSlotKeys({ "guitar:gtr1": "guitar:0" }),
    });

    expect(rows.find((r) => r.rawKey === "voc_cap_no_mic")?.labelIsCanonical).toBe(true);
  });
});

type InputDefLike = {
  key: string;
  label: string;
  note?: string;
  group?: DocInput["group"];
};

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
        rawKey: "bass_mic",
        label: "Bass mic",
        note: "",
        group: "bass",
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

    expect(rows.map((r) => r.rawKey)).toEqual(["bass_mic"]);
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

  it("carries the disabled channel's own group instead of assuming the owner's role", () => {
    const setupForSlot = stubSetup({
      defaults: [{ key: "vocal_mic", label: "Vocal mic", group: "vocs" }],
      effective: [],
    });

    const rows = collectDisabledInputRows({
      lineup: { guitar: [{ musicianId: "m1" }] },
      roleOrder: ["guitar"],
      setupForSlot,
    });

    expect(rows[0].group).toBe("vocs");
  });

  // Important 3 (review): `resolveEffectiveProjectSetup.ts:76-80` ignores
  // `presetOverride.inputs.remove`/`removeKeys` for a drums slot entirely —
  // `buildDocument` builds drum channels only from `drumDefinition`. A stale
  // `removeKeys` left on the slot (a leftover of the `01` kit editor, while
  // Task 19 stays parked) must not produce a struck-through "disabled" row
  // for a channel the document keeps printing active.
  it("never reports a drums slot's channel as disabled, even with a removeKeys patch the document ignores", () => {
    let calls = 0;
    const setupForSlot: SetupForSlot = () => {
      calls++;
      return {
        resolved: {
          defaultPreset: {
            inputs: [
              { key: "dr_tom_1", label: "Tom 1" },
              { key: "dr_tom_2", label: "Tom 2" },
            ],
            monitoring: {},
          },
        },
        // Mirrors what the document actually builds: `removeKeys` never
        // reaches the drums branch, so `dr_tom_2` stays in `effective` too.
        effective: {
          inputs: [
            { key: "dr_tom_1", label: "Tom 1" },
            { key: "dr_tom_2", label: "Tom 2" },
          ],
          monitoring: {},
        },
      } as never;
    };

    const rows = collectDisabledInputRows({
      lineup: {
        drums: [
          {
            musicianId: "dr1",
            presetOverride: { inputs: { removeKeys: ["dr_tom_2"] } },
          },
        ],
      },
      roleOrder: ["drums"],
      setupForSlot,
    });

    expect(rows).toEqual([]);
    expect(calls).toBe(0);
  });
});
