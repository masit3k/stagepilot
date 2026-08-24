import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../../infra/fs/repo.js";
import type { Musician } from "../../model/types.js";
import type { MonitorPresetIndex } from "../../monitors/getMonitorLabel.js";
import {
  type MonitorOwner,
  buildPdfMonitorRows,
} from "./buildPdfMonitorRows.js";

/**
 * F5d Nález 1 — vokální monitor mix nesmí přežít odebrání z overlay.
 *
 * Vlastníky monitorových řádků staví `resolvePdfMonitorOwners` z lineupu, ne
 * z overlays. Vyprázdnění `overlays.leadVocals` proto samo o sobě mix
 * neuklidilo a dokument vyšel s nula vokálními kanály a s vokálním monitor
 * mixem.
 */
describe("resolvePdfMonitorOwners via buildPdfMonitorRows (F5d Nález 1)", () => {
  const singer: Musician = {
    id: "voc-1",
    firstName: "Voc",
    lastName: "One",
    group: "vocs",
    gender: "m",
    presets: [{ kind: "monitor", ref: "wedge_foh" }],
  };
  const bassist: Musician = {
    id: "bass-1",
    firstName: "Bass",
    lastName: "One",
    group: "bass",
    presets: [{ kind: "monitor", ref: "wedge_foh" }],
  };

  /** `monitorsById` nese `wedge_foh`, takže `repo.getPreset` se nemá volat. */
  const repo: DataRepository = {
    getBand: () => {
      throw new Error("getBand is not expected here");
    },
    getMusician: () => {
      throw new Error("getMusician is not expected here");
    },
    getProject: () => {
      throw new Error("getProject is not expected here");
    },
    getPreset: (id: string) => {
      throw new Error(`getPreset is not expected here (${id})`);
    },
    getNotesTemplate: () => {
      throw new Error("getNotesTemplate is not expected here");
    },
  };

  function rowsFor(args: {
    lineupMusicians?: MonitorOwner[];
    leadSlots: Array<[string, number]>;
    backSlots: Array<[string, number]>;
  }) {
    const lineupMusicians = args.lineupMusicians ?? [
      { group: "bass" as const, musician: bassist },
      { group: "vocs" as const, musician: singer },
    ];
    const effectiveSetupByMusicianId = new Map(
      lineupMusicians.map(({ musician }) => [
        musician.id,
        { monitoring: { monitorRef: "wedge_foh" } },
      ]),
    );
    const monitorsById: MonitorPresetIndex = {
      wedge_foh: { id: "wedge_foh", label: "Wedge" },
    };
    return buildPdfMonitorRows({
      lineupMusicians,
      effectiveSetupByMusicianId,
      monitorsById,
      repo,
      leadVocsCount: args.leadSlots.length,
      leadVocsSlotByMusicianId: new Map(args.leadSlots),
      leadVocsGenderBySlot: args.leadSlots.map(() => "m"),
      backVocsCount: args.backSlots.length,
      backVocsSlotByMusicianId: new Map(args.backSlots),
      backVocsGenderBySlot: args.backSlots.map(() => undefined),
    });
  }

  it("gives a vocs slot a monitor mix while he is in the lead overlay", () => {
    const rows = rowsFor({ leadSlots: [["voc-1", 1]], backSlots: [] });

    expect(rows.map((row) => row.ownerMusicianId)).toEqual(["voc-1", "bass-1"]);
    expect(rows.map((row) => row.no)).toEqual(["1", "2"]);
  });

  it("drops the monitor mix of a vocs slot that is in no overlay at all", () => {
    // Odebrání lead vokalisty přes `Change` na `01` vyprázdní
    // `overlays.leadVocals`, ale lineup slot nechá být. Monitorové řádky se
    // staví z lineupu, takže mix zpěváka, který netiskne jediný kanál,
    // dřív přežil — dokument s nula vokálními kanály a vokálním monitor mixem.
    const rows = rowsFor({ leadSlots: [], backSlots: [] });

    expect(rows.map((row) => row.ownerMusicianId)).toEqual(["bass-1"]);
    expect(rows.map((row) => row.no)).toEqual(["1"]);
  });

  it("keeps the monitor mix of a vocs slot who moved to the back overlay", () => {
    const rows = rowsFor({ leadSlots: [], backSlots: [["voc-1", 1]] });

    expect(rows.map((row) => row.ownerMusicianId)).toEqual(["voc-1", "bass-1"]);
  });

  it("keeps the monitor mix of a singer who covers an instrument slot", () => {
    // Kritérium je lineup role `owner.group`, ne `musician.group`: zpěvák,
    // který v téhle sestavě obsluhuje bas, má svůj slot kvůli base a monitor
    // si nechává i mimo overlays. Filtr přes `musician.group` by ho utnul.
    const rows = rowsFor({
      lineupMusicians: [{ group: "bass", musician: singer }],
      leadSlots: [],
      backSlots: [],
    });

    expect(rows.map((row) => row.ownerMusicianId)).toEqual(["voc-1"]);
    expect(rows.map((row) => row.ownerRole)).toEqual(["bass"]);
  });
});
