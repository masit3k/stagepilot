import { describe, expect, it } from "vitest";
import type { MusicianSetupPreset } from "../../../../../../src/domain/model/types";
import { resolveDroppedUserEdits } from "./resolveDroppedUserEdits";

/**
 * Popisky i poznámka jsou verbatim z
 * `data/assets/presets/groups/guitar/el_guitar_mic.json` a
 * `.../ac_guitar.json`; `el_guitar_xlr` je klíč z `el_guitar_xlr_mono.json`.
 * Uložený kanál v presetu žádné pole `group` nenese (změřeno: 16 souborů
 * presetů, 18 prvků `inputs[]`, 0 s `group`) — v efektivním presetu ho ale
 * doplní lineup group, takže fixtura ho drží.
 */
const GUITAR_DEFAULT: MusicianSetupPreset = {
  inputs: [
    {
      key: "el_guitar_mic",
      label: "Electric guitar",
      note: "Mic on cabinet – small boom mic stand",
      group: "guitar",
    },
  ],
  monitoring: { monitorRef: "wedge_foh" },
};

describe("resolveDroppedUserEdits", () => {
  it("reports a renamed channel the switch would drop, under the user's own label", () => {
    const dropped = resolveDroppedUserEdits({
      defaultPreset: GUITAR_DEFAULT,
      currentPatch: {
        inputs: { update: [{ key: "el_guitar_mic", label: "Matej's Tele" }] },
      },
      nextPatch: {
        inputs: {
          remove: ["el_guitar_mic"],
          add: [
            { key: "el_guitar_xlr", label: "Electric guitar", group: "guitar" },
          ],
        },
      },
    });

    // Efektivní podoba kanálu, ne ta z presetu: popisek je uživatelův,
    // poznámka zůstala z presetu a mizí s ním, takže do výpisu patří taky.
    expect(dropped).toEqual([
      {
        key: "el_guitar_mic",
        label: "Matej's Tele",
        note: "Mic on cabinet – small boom mic stand",
      },
    ]);
  });

  it("reports a channel that only carries a note", () => {
    const dropped = resolveDroppedUserEdits({
      defaultPreset: GUITAR_DEFAULT,
      currentPatch: {
        inputs: {
          update: [
            { key: "el_guitar_mic", note: "Vintage 57, handle with care" },
          ],
        },
      },
      nextPatch: { inputs: { remove: ["el_guitar_mic"] } },
    });

    expect(dropped).toEqual([
      {
        key: "el_guitar_mic",
        label: "Electric guitar",
        note: "Vintage 57, handle with care",
      },
    ]);
  });

  it("stays silent when the dropped channel carries no user edit", () => {
    // Switching connection on an untouched channel is the ordinary case and
    // must not ask anything.
    expect(
      resolveDroppedUserEdits({
        defaultPreset: GUITAR_DEFAULT,
        currentPatch: undefined,
        nextPatch: {
          inputs: {
            remove: ["el_guitar_mic"],
            add: [
              {
                key: "el_guitar_xlr",
                label: "Electric guitar",
                group: "guitar",
              },
            ],
          },
        },
      }),
    ).toEqual([]);
  });

  it("stays silent when a rename does not drop anything", () => {
    // A rename over an already renamed channel: `editedKeys` is non-empty, so
    // the after-set genuinely has to be computed. With `currentPatch:
    // undefined` the early return alone would carry the assertion and the test
    // would pass even if `nextPatch` were ignored altogether.
    expect(
      resolveDroppedUserEdits({
        defaultPreset: GUITAR_DEFAULT,
        currentPatch: {
          inputs: { update: [{ key: "el_guitar_mic", label: "Matej's Tele" }] },
        },
        nextPatch: {
          inputs: {
            update: [{ key: "el_guitar_mic", label: "Matej's Strat" }],
          },
        },
      }),
    ).toEqual([]);
  });

  it("stays silent when the edited channel survives the switch", () => {
    const stereoDefault: MusicianSetupPreset = {
      inputs: [
        { key: "el_guitar_mic", label: "Electric guitar", group: "guitar" },
        { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
      ],
      monitoring: { monitorRef: "wedge_foh" },
    };

    expect(
      resolveDroppedUserEdits({
        defaultPreset: stereoDefault,
        currentPatch: {
          inputs: { update: [{ key: "ac_guitar", label: "Martin D-28" }] },
        },
        nextPatch: {
          inputs: {
            remove: ["el_guitar_mic"],
            update: [{ key: "ac_guitar", label: "Martin D-28" }],
          },
        },
      }),
    ).toEqual([]);
  });

  it("reports every dropped edited channel, in effective order", () => {
    const twoEdits: MusicianSetupPreset = {
      inputs: [
        { key: "el_guitar_mic", label: "Electric guitar", group: "guitar" },
        { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
      ],
      monitoring: { monitorRef: "wedge_foh" },
    };

    const dropped = resolveDroppedUserEdits({
      defaultPreset: twoEdits,
      currentPatch: {
        inputs: {
          update: [
            { key: "el_guitar_mic", label: "Tele" },
            { key: "ac_guitar", note: "Capo 2" },
          ],
        },
      },
      nextPatch: { inputs: { remove: ["el_guitar_mic", "ac_guitar"] } },
    });

    expect(dropped.map((item) => item.key)).toEqual([
      "el_guitar_mic",
      "ac_guitar",
    ]);
  });

  it("returns nothing when the next patch adds without dropping", () => {
    expect(
      resolveDroppedUserEdits({
        defaultPreset: GUITAR_DEFAULT,
        currentPatch: {
          inputs: { update: [{ key: "el_guitar_mic", label: "Tele" }] },
        },
        nextPatch: {
          inputs: {
            update: [{ key: "el_guitar_mic", label: "Tele" }],
            add: [
              { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
            ],
          },
        },
      }),
    ).toEqual([]);
  });
});
