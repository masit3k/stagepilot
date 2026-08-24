import { describe, expect, it } from "vitest";
import type {
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { resolveInputsPatchCommit } from "./resolveInputsPatchCommit";

const defaultPreset: MusicianSetupPreset = {
  inputs: [
    {
      key: "el_guitar_mic",
      label: "Electric guitar",
      group: "guitar",
      note: "Mic on cabinet – small boom mic stand",
    },
    {
      key: "ac_guitar",
      label: "Acoustic guitar",
      group: "guitar",
      note: "TS jack 6.3mm – DI box",
    },
  ],
  monitoring: { monitorRef: "wedge_foh" },
};

const renamedMic: PresetOverridePatch = {
  inputs: { update: [{ key: "el_guitar_mic", label: "Sennheiser e906" }] },
};

describe("resolveInputsPatchCommit", () => {
  it("commits a patch that drops no user edit", () => {
    const rawPatch: PresetOverridePatch = {
      inputs: { update: [{ key: "ac_guitar", label: "Taylor 814ce" }] },
    };

    const decision = resolveInputsPatchCommit({
      defaultPreset,
      currentPatch: undefined,
      rawPatch,
    });

    expect(decision.kind).toBe("commit");
    expect(decision.patch?.inputs?.update).toEqual([
      { key: "ac_guitar", label: "Taylor 814ce" },
    ]);
  });

  it("parks a patch that would drop a user-edited channel", () => {
    // Přepnutí, které kanál `el_guitar_mic` z efektivní sady odstraní,
    // uživatelovo `Sennheiser e906` zahodí. Parkování je jediný okamžik, kdy
    // se na to dá zeptat dopředu (R5).
    const rawPatch: PresetOverridePatch = {
      inputs: { ...renamedMic.inputs, remove: ["el_guitar_mic"] },
    };

    const decision = resolveInputsPatchCommit({
      defaultPreset,
      currentPatch: renamedMic,
      rawPatch,
    });

    expect(decision.kind).toBe("confirm");
    if (decision.kind !== "confirm") throw new Error("expected confirm");
    expect(decision.dropped.map((item) => item.label)).toEqual([
      "Sennheiser e906",
    ]);
  });

  it("normalizes a patch that lands back on the default to undefined", () => {
    // `normalizeSetupOverridePatch` je důvod, proč tohle rozhodnutí nesmí
    // zůstat v komponentě bez testu: bez něj by v projektu zůstal patch, který
    // nic nemění, a `DEVIATIONS N` by lhal.
    const rawPatch: PresetOverridePatch = {
      inputs: { update: [{ key: "ac_guitar", label: "Acoustic guitar" }] },
    };

    const decision = resolveInputsPatchCommit({
      defaultPreset,
      currentPatch: undefined,
      rawPatch,
    });

    expect(decision.kind).toBe("commit");
    expect(decision.patch).toBeUndefined();
  });

  it("parks a legacy bass add that normalization turns into a replace", () => {
    // `normalizeBassConnectionOverridePatch` přepíše legacy `add` hlavního
    // basového kanálu na `replace`, takže původní kanál z efektivní sady
    // zmizí i s uživatelovým přejmenováním — jediný tvar patche, kde se sada
    // klíčů mění až normalizací, a proto vlastní test.
    const bassDefault: MusicianSetupPreset = {
      inputs: [
        {
          key: "el_bass_xlr_pedalboard",
          label: "Electric bass guitar",
          group: "bass",
          note: "XLR out from pedalboard",
        },
      ],
      monitoring: { monitorRef: "wedge_foh" },
    };
    const renamedBass: PresetOverridePatch = {
      inputs: {
        update: [{ key: "el_bass_xlr_pedalboard", label: "Fender Jazz" }],
      },
    };
    const rawPatch: PresetOverridePatch = {
      inputs: {
        ...renamedBass.inputs,
        add: [
          {
            key: "el_bass_xlr_amp",
            label: "Electric bass guitar",
            group: "bass",
            note: "XLR out from amp",
          },
        ],
      },
    };

    const decision = resolveInputsPatchCommit({
      defaultPreset: bassDefault,
      currentPatch: renamedBass,
      rawPatch,
    });

    expect(decision.kind).toBe("confirm");
    if (decision.kind !== "confirm") throw new Error("expected confirm");
    expect(decision.dropped.map((item) => item.label)).toEqual(["Fender Jazz"]);
  });

  it("commits when the user never edited anything", () => {
    const rawPatch: PresetOverridePatch = {
      inputs: { remove: ["el_guitar_mic"] },
    };

    const decision = resolveInputsPatchCommit({
      defaultPreset,
      currentPatch: undefined,
      rawPatch,
    });

    expect(decision.kind).toBe("commit");
    expect(decision.patch?.inputs?.remove).toEqual(["el_guitar_mic"]);
  });
});
