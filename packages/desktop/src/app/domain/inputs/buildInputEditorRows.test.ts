import { describe, expect, it } from "vitest";
import { buildInputEditorRows } from "./buildInputEditorRows";

const DEFAULTS = [
  { key: "el_bass_di", label: "Bass DI", note: "DI box", group: "bass" },
  { key: "el_bass_mic", label: "Bass mic", group: "bass" },
];

/**
 * Stub `setupForSlot`: `defaultPreset` je vždy celý katalog slotu,
 * `effective` jen klíče, které mají po aplikaci patche zůstat.
 */
function stubSetup(effectiveKeys: string[], extra: typeof DEFAULTS = []) {
  return () =>
    ({
      resolved: { defaultPreset: { inputs: DEFAULTS, monitoring: {} } },
      effective: {
        inputs: [
          ...DEFAULTS.filter((input) => effectiveKeys.includes(input.key)),
          ...extra,
        ],
        monitoring: {},
      },
    }) as never;
}

const LINEUP = { bass: [{ musicianId: "m1" }] };
const ROLES = ["bass"] as const;

describe("buildInputEditorRows", () => {
  it("numbers active rows from one", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di", "el_bass_mic"]),
    });

    expect(rows.map((row) => [row.key, row.ch])).toEqual([
      ["el_bass_di", 1],
      ["el_bass_mic", 2],
    ]);
  });

  it("keeps a removed channel in the list without a number (R3)", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di"]),
    });

    expect(rows).toHaveLength(2);
    const removed = rows.find((row) => row.key === "el_bass_mic");
    expect(removed?.state).toBe("removed");
    expect(removed?.ch).toBeNull();
  });

  it("does not let a removed row consume a channel number", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_mic"]),
    });

    expect(rows.find((row) => row.key === "el_bass_mic")?.ch).toBe(1);
  });

  it("treats a channel the project added as active", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di"], [
        { key: "extra", label: "Extra", group: "bass" },
      ]),
    });

    expect(rows.find((row) => row.key === "extra")?.state).toBe("active");
  });

  it("carries the owner so the inspector can show it (R2)", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di"]),
    });

    expect(rows[0].ownerMusicianId).toBe("m1");
    expect(rows[0].ownerRole).toBe("bass");
    expect(rows[0].slotKey).toBe("bass:0");
  });

  it("follows the manual order", () => {
    const rows = buildInputEditorRows({
      lineup: LINEUP,
      roleOrder: ROLES,
      inputOrder: ["el_bass_mic", "el_bass_di"],
      setupForSlot: stubSetup(["el_bass_di", "el_bass_mic"]),
    });

    expect(rows.map((row) => row.key)).toEqual([
      "el_bass_mic",
      "el_bass_di",
    ]);
  });

  it("skips a slot with no musician", () => {
    const rows = buildInputEditorRows({
      lineup: { bass: [{ musicianId: "" }] },
      roleOrder: ROLES,
      inputOrder: undefined,
      setupForSlot: stubSetup(["el_bass_di"]),
    });

    expect(rows).toEqual([]);
  });

  it("shows a stereo filler channel the way the document prints it", () => {
    const stereo = [
      { key: "keys_l", label: "Keys L", group: "keys" },
      { key: "keys_r", label: "Keys R", group: "keys" },
    ];

    const rows = buildInputEditorRows({
      lineup: { keys: [{ musicianId: "m2" }] },
      roleOrder: ["keys"],
      // Mono kanál před párem posune pár na sudé číslo, takže `assignPdfChannels`
      // musí vložit výplň — editor ji zobrazí, protože se tiskne.
      inputOrder: ["mono", "keys_l", "keys_r"],
      setupForSlot: (() =>
        ({
          resolved: {
            defaultPreset: {
              inputs: [{ key: "mono", label: "Mono", group: "keys" }, ...stereo],
              monitoring: {},
            },
          },
          effective: {
            inputs: [{ key: "mono", label: "Mono", group: "keys" }, ...stereo],
            monitoring: {},
          },
        }) as never),
    });

    const filler = rows.find((row) => row.state === "filler");
    expect(filler?.label).toBe("---");
    expect(rows.find((row) => row.key === "keys_l")?.ch).toBe(3);
    expect(rows.find((row) => row.key === "keys_r")?.ch).toBe(4);
  });
});
