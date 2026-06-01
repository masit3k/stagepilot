import { describe, expect, it } from "vitest";
import type {
  DocumentViewModel,
  Musician,
  Project,
} from "../../model/types.js";
import { buildPdfStageplanModel } from "./buildPdfStageplan.js";
import { buildPdfStageplanPrintModel } from "./buildPdfStageplanPrintModel.js";

function baseStageplan(
  overrides: Partial<DocumentViewModel["stageplan"]> = {},
): DocumentViewModel["stageplan"] {
  return {
    lineupByRole: {
      drums: { musicianId: "drm-1", firstName: "Dana", isBandLeader: false },
      bass: { musicianId: "bass-1", firstName: "Ben", isBandLeader: false },
      guitar: { musicianId: "gtr-1", firstName: "Gina", isBandLeader: false },
      keys: { musicianId: "keys-1", firstName: "Kim", isBandLeader: false },
      vocs: { musicianId: "lead-1", firstName: "Alice", isBandLeader: true },
    },
    leadVocals: [
      { musicianId: "lead-1", firstName: "Alice", isBandLeader: true },
      { musicianId: "lead-2", firstName: "Bob", isBandLeader: false },
    ],
    inputs: [],
    monitorOutputs: [],
    powerByRole: {},
    ...overrides,
  };
}

describe("buildPdfStageplanPrintModel", () => {
  it("assigns primary instruments and lead vocal inputs to stageplan boxes", () => {
    const model = buildPdfStageplanPrintModel(
      baseStageplan({
        inputs: [
          { channelNo: 1, label: "Kick", group: "drums" },
          { channelNo: 2, label: "Snare", group: "drums" },
          { channelNo: 5, label: "Bass DI", group: "bass" },
          { channelNo: 6, label: "Electric guitar", group: "guitar" },
          { channelNo: 7, label: "Keys L", group: "keys" },
          { channelNo: 8, label: "Keys R", group: "keys" },
          {
            channelNo: 9,
            label: "Lead vocal",
            group: "vocs",
            ownerMusicianId: "lead-2",
          },
        ],
      }),
    );

    expect(model.boxesBySlot.drums.inputBullets).toContain("Drums (1–2)");
    expect(model.boxesBySlot.bass.inputBullets).toContain("Bass DI (5)");
    expect(model.boxesBySlot.guitar.inputBullets).toContain(
      "Electric guitar (6)",
    );
    expect(model.boxesBySlot.keys.inputBullets).toContain("Keys (7+8)");
    expect(model.boxesBySlot.lead_voc_2.inputBullets).toContain(
      "Lead vocal (9)",
    );
  });

  it("prepares lead vocal headers from current lead slot behavior", () => {
    const model = buildPdfStageplanPrintModel(baseStageplan());

    expect(model.boxesBySlot.lead_voc_1.header).toBe(
      "LEAD VOC – ALICE (band leader)",
    );
    expect(model.boxesBySlot.lead_voc_2.header).toBe("LEAD VOC – BOB");
  });

  it("does not render spare inputs excluded by the stageplan document model", () => {
    const drummer: Musician = {
      id: "drm-1",
      firstName: "Dana",
      lastName: "Drums",
      group: "drums",
      presets: [],
    };
    const project: Project = {
      id: "spares",
      bandRef: "band",
      purpose: "generic",
      documentDate: "2024-01-01",
    };

    const stageplan = buildPdfStageplanModel({
      lineupMusicians: [{ group: "drums", musician: drummer }],
      lineup: {
        keys: [],
        drums: ["drm-1"],
        bass: [],
        guitar: [],
        vocs: [],
        talkback: [],
      },
      project,
      membersById: new Map([["drm-1", drummer]]),
      bandLeaderId: "drm-1",
      leadOverlayMembers: [],
      inputsWithCh: [
        {
          ch: 1,
          key: "kick",
          label: "Kick",
          group: "drums",
          ownerRole: "drums",
          ownerMusicianId: "drm-1",
        },
        {
          ch: 2,
          key: "spare_ch_2",
          label: "---",
          group: "drums",
          ownerRole: "drums",
        },
      ],
      monitorTableRows: [],
    });
    const model = buildPdfStageplanPrintModel(stageplan);

    expect(model.boxesBySlot.drums.inputBullets).toEqual(["Drums (1)"]);
    expect(model.boxesBySlot.drums.inputBullets.join(" ")).not.toContain("---");
  });

  it("keeps stageplan stereo collapse and drum aggregation behavior", () => {
    const model = buildPdfStageplanPrintModel(
      baseStageplan({
        inputs: [
          { channelNo: 1, label: "Kick OUT", group: "drums" },
          { channelNo: 2, label: "Kick IN", group: "drums" },
          { channelNo: 3, label: "PAD SFX L", group: "drums" },
          { channelNo: 4, label: "PAD SFX R", group: "drums" },
          { channelNo: 5, label: "Backing track L", group: "drums" },
          { channelNo: 6, label: "Backing track R", group: "drums" },
          { channelNo: 7, label: "Bass L (main out L)", group: "bass" },
          { channelNo: 8, label: "Bass R (main out R)", group: "bass" },
        ],
      }),
    );

    expect(model.boxesBySlot.drums.inputBullets).toEqual(
      expect.arrayContaining([
        "Drums (1–2)",
        "PAD SFX (3+4)",
        "Backing track (5+6)",
      ]),
    );
    expect(model.boxesBySlot.bass.inputBullets).toEqual(["Bass (7+8)"]);
  });

  it("maps monitor outputs to owners and preserves power badges", () => {
    const model = buildPdfStageplanPrintModel(
      baseStageplan({
        monitorOutputs: [
          {
            no: 1,
            output: "Lead vocal 2",
            note: "Wedge monitor",
            ownerRole: "vocs",
            ownerMusicianId: "lead-2",
          },
          {
            no: 2,
            output: "Guitar",
            note: "IEM STEREO wireless + Additional wedge monitor 1x",
            ownerRole: "guitar",
            ownerMusicianId: "gtr-1",
          },
        ],
        powerByRole: {
          guitar: { hasPowerBadge: true, powerBadgeText: "4x 230 V" },
        },
      }),
    );

    expect(model.boxesBySlot.lead_voc_2.monitorBullets).toEqual([
      "Wedge monitor (1)",
    ]);
    expect(model.boxesBySlot.guitar.monitorBullets).toEqual([
      "IEM STEREO wireless (2)",
      "+ Additional wedge monitor 1x",
    ]);
    expect(model.boxesBySlot.guitar.hasPowerBadge).toBe(true);
    expect(model.boxesBySlot.guitar.powerBadgeText).toBe("4x 230 V");
  });
});
