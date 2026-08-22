import { describe, expect, it } from "vitest";
import type {
  Band,
  Musician,
  NotesTemplate,
  Preset,
  PresetEntity,
  PresetOverridePatch,
  Project,
} from "../../../../../../src/domain/model/types";
import { buildDocument } from "../../../../../../src/domain/pipeline/buildDocument";
import type { DataRepository } from "../../../../../../src/infra/fs/repo";
import { resolveDroppedUserEdits } from "./resolveDroppedUserEdits";
import { resolveInputRowEditability } from "./resolveInputRowEditability";
import { resolveInputsFieldSections } from "./resolveInputsFieldSections";
import { resolveMonitorRowEditability } from "./resolveMonitorRowEditability";

/**
 * Kontraktní vrstva UI <-> dokument (F5d R8).
 *
 * Vzorec „UI drží stav, který doména nemá" se ve F5c objevil sedmkrát a ani
 * jednou nešlo o rozbité zavěšení handleru — vždy o rozjezd dvou zdrojů
 * pravdy. UI-preview `resolveEffectiveMusicianSetup` aplikuje patch vždy a bez
 * ohledu na roli; doména ho u některých řezů zahodí. Test v jsdom by viděl, že
 * se UI změnilo správně, protože UI se opravdu změní správně. Špatný je
 * dokument, a ten v DOM není.
 *
 * Každý test tady proto tvrdí DVĚ věci nad TÝMIŽ daty: co říká UI (`canEdit`,
 * přeškrtnutý řádek, `DEVIATIONS N`) a co nad nimi skutečně vyprodukuje
 * `buildDocument`. Jeden test na každou bránu, kterou fáze otevírá nebo
 * zavírá. Čistý node test, žádné DOM.
 */

const NOTES: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

const MONITORS: Record<string, PresetEntity> = {
  wedge_foh: {
    type: "monitor",
    id: "wedge_foh",
    label: "Wedge",
    kind: "wedge",
    supplier: "foh",
  },
  iem_stereo_wired_foh: {
    type: "monitor",
    id: "iem_stereo_wired_foh",
    label: "IEM STEREO wired",
    kind: "iem",
    supplier: "foh",
    mode: "stereo",
    wireless: false,
  },
  talkback: {
    type: "talkback_type",
    id: "talkback",
    label: "Talkback",
    group: "talkback",
    input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
  },
};

/** Minimal repo over an explicit preset map — every test states its own catalog. */
function makeRepo(args: {
  band: Band;
  musicians: Record<string, Musician>;
  project: Project;
  presets?: Record<string, PresetEntity>;
}): DataRepository {
  const presets = { ...MONITORS, ...(args.presets ?? {}) };
  return {
    getBand: () => args.band,
    getMusician: (id: string) => {
      const musician = args.musicians[id];
      if (!musician) throw new Error(`unknown musician ${id}`);
      return musician;
    },
    getProject: () => args.project,
    getPreset: (id: string) => {
      const preset = presets[id];
      if (!preset) throw new Error(`unknown preset ${id}`);
      return preset;
    },
    getNotesTemplate: () => NOTES,
  };
}

describe("contract: drums monitoring (F5d R3)", () => {
  it("UI reports canEdit and the document prints that monitor mix", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
      group: "drums",
      presets: [{ kind: "monitor", ref: "wedge_foh" }],
    };
    const project: Project = {
      id: "p-drums-monitoring",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: {
        drums: {
          musicianId: "dr-1",
          presetOverride: {
            monitoring: { monitorRef: "iem_stereo_wired_foh" },
          },
        },
      },
    };

    // What the UI claims.
    expect(
      resolveMonitorRowEditability({ slotKey: "drums:0", ownerRole: "drums" }),
    ).toEqual({ canEdit: true });

    // What the document actually produces over the same data.
    const vm = buildDocument(
      project,
      makeRepo({ band, musicians: { "dr-1": drummer }, project }),
    );
    const drumsMonitorRow = vm.monitorTableRows.find(
      (row) => row.ownerMusicianId === "dr-1",
    );
    expect(drumsMonitorRow?.note).toContain("IEM STEREO wired");
  });
});

describe("contract: drums channels stay patch-proof (F5d R2)", () => {
  it("UI refuses remove/restore and the document ignores add and removeKeys", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "dr-1",
      defaultLineup: { drums: ["dr-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const drummer: Musician = {
      id: "dr-1",
      firstName: "Dr",
      lastName: "One",
      group: "drums",
      presets: [{ kind: "monitor", ref: "wedge_foh" }],
    };

    const clean: Project = {
      id: "p-drums-clean",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { drums: { musicianId: "dr-1" } },
    };
    // Both halves of this patch are deliberately *reachable*: `dr_kick_1_out`
    // is a real channel of the default kit and `dr_tom_3` is not, so an
    // un-narrowed application changes the printed list in both directions.
    // Measured un-narrowed (`applyPresetOverride` over the drum preset):
    // `dr_kick_1_out` drops out and `dr_tom_3` is appended. A patch keyed on
    // a channel the kit never had would make this test vacuous.
    const patched: Project = {
      ...clean,
      id: "p-drums-patched",
      lineup: {
        drums: {
          musicianId: "dr-1",
          presetOverride: {
            inputs: {
              add: [{ key: "dr_tom_3", label: "Tom 3", group: "drums" }],
              removeKeys: ["dr_kick_1_out"],
            },
          },
        },
      },
    };

    // What the UI claims: the buttons that would write this patch are closed.
    expect(
      resolveInputRowEditability({ ownerRole: "drums", group: "drums" }),
    ).toEqual({ canEdit: false, reason: "drums-not-supported" });

    // What the document does: nothing. Not a collision error either — the
    // narrowing in `resolveEffectiveProjectSetup` drops add/removeKeys before
    // `applyPresetOverride` can hit its collision guard (Critical 1, task 12c).
    const cleanVm = buildDocument(
      clean,
      makeRepo({ band, musicians: { "dr-1": drummer }, project: clean }),
    );
    const patchedVm = buildDocument(
      patched,
      makeRepo({ band, musicians: { "dr-1": drummer }, project: patched }),
    );

    expect(patchedVm.inputs.map((row) => row.key)).toEqual(
      cleanVm.inputs.map((row) => row.key),
    );
    expect(patchedVm.inputs.some((row) => row.key === "dr_tom_3")).toBe(false);
    expect(patchedVm.inputs.some((row) => row.key === "dr_kick_1_out")).toBe(
      true,
    );
  });
});

describe("contract: overlay rows stay patch-proof (F5d R7, O2)", () => {
  const band: Band = {
    id: "band",
    name: "Band",
    bandLeader: "voc-1",
    defaultLineup: { vocs: ["voc-1"] },
    defaultOverlays: { leadVocals: ["voc-1"], backVocals: [] },
  };
  const singer: Musician = {
    id: "voc-1",
    firstName: "Voc",
    lastName: "One",
    group: "vocs",
    gender: "m",
    presets: [
      { kind: "preset", ref: "vocal_wireless" },
      { kind: "monitor", ref: "wedge_foh" },
    ],
  };
  const presets: Record<string, PresetEntity> = {
    vocal_wireless: {
      type: "preset",
      id: "vocal_wireless",
      label: "Vocal (wireless)",
      group: "vocs",
      capabilities: ["vocal"],
      inputs: [{ key: "voc_input", label: "Vocal", note: "Own wireless mic" }],
    },
  };

  const clean: Project = {
    id: "p-voc-clean",
    bandRef: "band",
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: { vocs: [{ musicianId: "voc-1" }] },
    overlays: { leadVocals: ["voc-1"], backVocals: [] },
  };
  const withInputsPatch = (
    id: string,
    inputs: NonNullable<PresetOverridePatch["inputs"]>,
  ): Project => ({
    ...clean,
    id,
    lineup: { vocs: [{ musicianId: "voc-1", presetOverride: { inputs } }] },
  });
  const vmOf = (project: Project) =>
    buildDocument(
      project,
      makeRepo({ band, musicians: { "voc-1": singer }, project, presets }),
    );

  it("UI reports overlay-not-supported for every vocal and talkback row", () => {
    // The criterion is `group`, not `ownerRole` — a bass player's back-vocal
    // row carries `ownerRole: "bass"` but `group: "vocs"`.
    expect(
      resolveInputRowEditability({ ownerRole: "vocs", group: "vocs" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
    expect(
      resolveInputRowEditability({ ownerRole: "bass", group: "vocs" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
    expect(
      resolveInputRowEditability({ ownerRole: "drums", group: "talkback" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
  });

  it("the document treats remove and removeKeys on an overlay row as a no-op", () => {
    // O2. Both keys are reachable on purpose: `voc_input` is the vocal
    // preset's own key and `voc_lead_1` is the key the document actually
    // prints. Measured un-narrowed (`applyPresetOverride` over the printed
    // row), `removeKeys: ["voc_lead_1"]` empties the list — so this asserts a
    // gate that really holds something back, not an absent target.
    const patched = withInputsPatch("p-voc-removed", {
      remove: ["voc_input"],
      removeKeys: ["voc_lead_1"],
    });

    expect(
      vmOf(patched).inputs.map((row) => [row.ch, row.key, row.label]),
    ).toEqual(vmOf(clean).inputs.map((row) => [row.ch, row.key, row.label]));
  });

  it("the document still prints an ownerless row for add on an overlay slot", () => {
    // NOT a no-op, and the plan's fixture expected it to be. Measured: `add`
    // on a `vocs` slot lands in the `eventOverride` branch
    // (`buildDocument.ts:610-622`), which does not exclude `vocs` and runs
    // *before* `resolveOverlayDrivenVocalRows` builds any vocal row — so
    // `affected` is empty, nothing collides, and the channel is appended as a
    // permanent orphan: `ownerMusicianId: undefined`, hence no owner, no
    // inspector action, no way back out of the document. That is exactly why
    // R1 keeps `inputs.add` closed for vocals and talkback and why the UI gate
    // above must not be widened. Locked as measured, not as wished.
    const patched = withInputsPatch("p-voc-added", {
      add: [{ key: "voc_extra", label: "Second mic", group: "vocs" }],
    });
    const orphans = vmOf(patched).inputs.filter(
      (row) => row.key === "voc_extra",
    );

    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.ownerMusicianId).toBeUndefined();
    // It even steals channel 1 from the real lead vocal row.
    expect(vmOf(patched).inputs.map((row) => [row.ch, row.key])).toEqual([
      [1, "voc_extra"],
      [2, "voc_lead_1"],
    ]);
  });
});
describe("contract: mono keys player (F5d R1, M4)", () => {
  it("both prefix copies route him to keys, the modal gets the keys catalog, and the document prints the channel", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "k-1",
      defaultLineup: { keys: ["k-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const keysPlayer: Musician = {
      id: "k-1",
      firstName: "Keys",
      lastName: "One",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys_mono_xlr" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    // Verbatim from data/assets/presets/groups/keys/keys_mono_xlr.json. The
    // stored channel carries no `group` field — none of the 16 preset files
    // does — so the bare key `keys` has to survive on the prefix branch of
    // both recognition copies (F5d R1, M4).
    const keysPreset: Preset = {
      type: "preset",
      id: "keys_mono_xlr",
      label: "Keys mono XLR",
      group: "keys",
      inputs: [{ key: "keys", label: "Keys", note: "XLR out from rack" }],
    };
    const channel = keysPreset.inputs[0];
    const presets: Record<string, PresetEntity> = {
      keys_mono_xlr: keysPreset,
    };
    const project: Project = {
      id: "p-keys-mono",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { keys: [{ slot: 1, musicianId: "k-1" }] },
    };

    // What the UI claims: the modal renders the keys catalog, not lead vocals.
    // The channels handed in are the preset's own array, the same object the
    // repo below serves to `buildDocument` — the two halves cannot drift.
    expect(
      resolveInputsFieldSections({
        role: "keys",
        effectiveInputs: keysPreset.inputs,
      }),
    ).toEqual([{ key: "keys", label: "keys", catalog: "keys" }]);

    // What the document produces over the same data: that one channel, under
    // the keys block, owned by the keys player, with its preset label and note
    // intact. Measured: `vm.inputs` holds exactly this one row.
    const vm = buildDocument(
      project,
      makeRepo({ band, musicians: { "k-1": keysPlayer }, project, presets }),
    );
    expect(
      vm.inputs.map((row) => [
        row.ch,
        row.key,
        row.label,
        row.note,
        row.group,
        row.ownerMusicianId,
      ]),
    ).toEqual([
      [1, channel?.key, channel?.label, channel?.note, "keys", "k-1"],
    ]);
  });
});
describe("contract: destructive connection switch (F5d R5)", () => {
  it("the helper reports the annotated channel and the document stops printing it", () => {
    const band: Band = {
      id: "band",
      name: "Band",
      bandLeader: "g-1",
      defaultLineup: { guitar: ["g-1"] },
      defaultOverlays: { leadVocals: [], backVocals: [] },
    };
    const guitarist: Musician = {
      id: "g-1",
      firstName: "Gtr",
      lastName: "One",
      group: "guitar",
      presets: [
        { kind: "preset", ref: "el_guitar_mic" },
        { kind: "monitor", ref: "wedge_foh" },
      ],
    };
    const presets: Record<string, PresetEntity> = {
      el_guitar_mic: {
        type: "preset",
        id: "el_guitar_mic",
        label: "Electric guitar (mic)",
        group: "guitar",
        inputs: [
          {
            key: "el_guitar_mic",
            label: "Electric guitar",
            note: "Mic on cabinet",
          },
        ],
      },
    };

    const defaultPreset = {
      inputs: [
        {
          key: "el_guitar_mic",
          label: "Electric guitar",
          note: "Mic on cabinet",
          group: "guitar" as const,
        },
      ],
      monitoring: { monitorRef: "wedge_foh" },
    };
    const currentPatch = {
      inputs: {
        update: [
          { key: "el_guitar_mic", note: "Vintage 57, handle with care" },
        ],
      },
    };
    // Změřeno nad reálným polem, ne vymyšleno: `withInputsTarget` emituje právě
    // tenhle patch, když kytarista přepne `Connection` na XLR (mikrofon zůstane
    // jako doplněk) a pak vypne přepínač `Mic on cabinet` —
    // `{ add: [el_guitar_xlr], remove: [el_guitar_mic] }` nad presety
    // z `data/assets/presets/groups/guitar/`. Jednokrokové přepnutí XLR mono →
    // XLR stereo dává tvarově totéž (`remove: ["el_guitar_xlr"]`).
    const nextPatch = {
      inputs: {
        remove: ["el_guitar_mic"],
        add: [
          {
            key: "el_guitar_xlr",
            label: "Electric guitar",
            group: "guitar" as const,
          },
        ],
      },
    };

    // What the UI claims: the note is about to be lost.
    expect(
      resolveDroppedUserEdits({ defaultPreset, currentPatch, nextPatch }),
    ).toEqual([
      {
        key: "el_guitar_mic",
        label: "Electric guitar",
        note: "Vintage 57, handle with care",
      },
    ]);

    // What the document does once the switch is applied.
    const project: Project = {
      id: "p-guitar-switched",
      bandRef: "band",
      purpose: "event",
      documentDate: "2026-01-01",
      lineup: { guitar: { musicianId: "g-1", presetOverride: nextPatch } },
    };
    const vm = buildDocument(
      project,
      makeRepo({ band, musicians: { "g-1": guitarist }, project, presets }),
    );

    // Sada řádků, ne dvě nezávislá `some()`: kdyby dokument vytiskl oba
    // kanály nebo si přehodil pořadí, dvě `toBe` by to pustily.
    expect(vm.inputs.map((row) => [row.ch, row.key])).toEqual([
      [1, "el_guitar_xlr"],
    ]);
    expect(vm.inputs.some((row) => row.key === "el_guitar_mic")).toBe(false);
  });
});
