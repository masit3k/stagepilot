import { describe, expect, it } from "vitest";
import type {
  Band,
  Musician,
  NotesTemplate,
  PresetEntity,
  Project,
} from "../../../../../../src/domain/model/types";
import { buildDocument } from "../../../../../../src/domain/pipeline/buildDocument";
import type { DataRepository } from "../../../../../../src/infra/fs/repo";
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
