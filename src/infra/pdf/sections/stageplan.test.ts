import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import { loadRepository } from "../../fs/repo.js";
import { buildDocument } from "../../../domain/pipeline/buildDocument.js";
import { __stageplanTestExports, buildStageplanPlan, matchStageplanLayout } from "./stageplan.js";
import { pdfChromeHeights, pdfLayout } from "../layout.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "../pdfRendererFixture.js";

describe("stageplan render plan", () => {
  it("builds boxes and respects typography for test fixture data", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();

    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("stageplan-smoke");

      const vm = buildDocument(project, repo);
      const plan = buildStageplanPlan(vm.stageplan);

      expect(plan.layout.layoutId).toBe("layout_5_party");
      expect(plan.boxes).toHaveLength(5);

      expect(plan.textStyle.fontSize).toBe(pdfLayout.typography.table.size);

      const drumsBox = plan.boxes.find((box) => box.slot === "drums");
      expect(drumsBox).toBeTruthy();
      expect(drumsBox?.header).toBe("DRUMS – PAVEL");

      const bassBox = plan.boxes.find((box) => box.slot === "bass");
      expect(bassBox).toBeTruthy();
      expect(bassBox?.header).toBe("BASS – MATEJ (band leader)");

      const inputBullets = drumsBox?.inputBullets ?? [];
      expect(inputBullets[0]).toMatch(/^Drums \(\d+(–\d+)?\)$/);
      expect(inputBullets).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^PAD SFX \(\d+\+\d+\)$/),
        ])
      );

      expect(drumsBox?.monitorBullets).toEqual(
        expect.arrayContaining(["IEM STEREO wired (5)"])
      );
      expect(drumsBox?.extraBullets).toEqual(
        expect.arrayContaining(["Drum riser 3x2"])
      );

      const topBoxes = plan.boxes.filter((box) => box.row === "top");
      const bottomBoxes = plan.boxes.filter((box) => box.row === "bottom");
      const topHeight = topBoxes[0]?.position.heightMm ?? 0;
      const bottomHeight = bottomBoxes[0]?.position.heightMm ?? 0;
      expect(topBoxes.every((box) => Math.abs(box.position.heightMm - topHeight) < 0.001)).toBe(true);
      expect(bottomBoxes.every((box) => Math.abs(box.position.heightMm - bottomHeight) < 0.001)).toBe(true);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("selects layout by lead vocalist count", () => {
    expect(
      matchStageplanLayout({
        lineupByRole: { vocs: { firstName: "A", isBandLeader: false } },
        leadVocals: [{ firstName: "A", isBandLeader: false }],
        inputs: [],
        monitorOutputs: [],
        powerByRole: {},
      }).id
    ).toBe("layout_5_party");

    expect(
      matchStageplanLayout({
        lineupByRole: {},
        leadVocals: [
          { firstName: "A", isBandLeader: false },
          { firstName: "B", isBandLeader: false },
        ],
        inputs: [],
        monitorOutputs: [],
        powerByRole: {},
      }).id
    ).toBe("layout_6_2_vocs");

    expect(
      matchStageplanLayout({
        lineupByRole: {},
        leadVocals: [
          { firstName: "A", isBandLeader: false },
          { firstName: "B", isBandLeader: false },
          { firstName: "C", isBandLeader: false },
        ],
        inputs: [],
        monitorOutputs: [],
        powerByRole: {},
      }).id
    ).toBe("layout_6_2_vocs");
  });

  it("renders layout_6_2_vocs in slot order with dynamic names", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {
        drums: { firstName: "Drummer", isBandLeader: false },
        bass: { firstName: "Bassist", isBandLeader: false },
        guitar: { firstName: "Guitarist", isBandLeader: false },
        keys: { firstName: "Keysman", isBandLeader: false },
      },
      leadVocals: [
        { firstName: "Alice", isBandLeader: false },
        { firstName: "Bob", isBandLeader: false },
      ],
      inputs: [
        { channelNo: 1, label: "Lead vocal 1", group: "vocs" },
        { channelNo: 2, label: "Lead vocal 2", group: "vocs" },
      ],
      monitorOutputs: [
        { no: 1, output: "Lead vocal 1", note: "IEM A" },
        { no: 2, output: "Lead vocal 2", note: "IEM B" },
      ],
      powerByRole: {},
    });

    expect(plan.layout.layoutId).toBe("layout_6_2_vocs");
    const bottomSlots = plan.boxes
      .filter((box) => box.row === "bottom")
      .sort((a, b) => a.position.xMm - b.position.xMm)
      .map((box) => box.slot);
    expect(bottomSlots).toEqual(["guitar", "lead_voc_1", "lead_voc_2", "keys"]);

    const lead1 = plan.boxes.find((box) => box.slot === "lead_voc_1");
    const lead2 = plan.boxes.find((box) => box.slot === "lead_voc_2");
    expect(lead1?.header).toContain("ALICE");
    expect(lead2?.header).toContain("BOB");
    expect(lead1?.header).not.toContain("TOMÁŠ");
    expect(lead2?.header).not.toContain("TOMÁŠ");

    const topCenter = plan.boxes.find((box) => box.slot === "drums");
    expect(topCenter?.position.xMm).toBeCloseTo(62.5, 5);
    expect(topCenter?.row).toBe("top");

    const legacyBottomWidthMm = (plan.layout.areaWidthMm - plan.layout.gapXmm * (4 - 1)) / 4;
    const bottomBoxes = plan.boxes
      .filter((box) => box.row === "bottom")
      .sort((a, b) => a.position.xMm - b.position.xMm);
    const bottomWidths = bottomBoxes.map((box) => box.position.widthMm);
    expect(bottomWidths.every((widthMm) => widthMm > legacyBottomWidthMm)).toBe(true);

    const bottomGutters = bottomBoxes.slice(0, -1).map((box, idx) => {
      const next = bottomBoxes[idx + 1];
      return next.position.xMm - (box.position.xMm + box.position.widthMm);
    });
    expect(bottomGutters.every((gutterMm) => Math.abs(gutterMm - 4.5) < 0.001)).toBe(true);

    const drumsTop = plan.boxes.find((box) => box.slot === "drums");
    const bassTop = plan.boxes.find((box) => box.slot === "bass");
    const topRowSnapshot = [
      { xMm: drumsTop?.position.xMm, widthMm: drumsTop?.position.widthMm },
      { xMm: bassTop?.position.xMm, widthMm: bassTop?.position.widthMm },
    ];
    expect(topRowSnapshot).toEqual([
      { xMm: plan.layout.boxWidthMm + plan.layout.gapXmm, widthMm: plan.layout.boxWidthMm },
      { xMm: 2 * (plan.layout.boxWidthMm + plan.layout.gapXmm), widthMm: plan.layout.boxWidthMm },
    ]);

    const debug = __stageplanTestExports.computeBottomRowGeometry({
      layoutId: plan.layout.layoutId,
      defaults: plan.layout,
      bottomRow: {
        columns: 4,
        gutterXmm: 4.5,
        sideInsetXmm: 2,
        slots: ["guitar", "lead_voc_1", "lead_voc_2", "keys"],
        typography: { fontSizeDeltaPt: -1, lineHeightDelta: -0.05, bulletSpacingPx: 4 },
      },
      stageAreaLeftMm: 0,
      stageAreaWidthMm: plan.layout.areaWidthMm,
      bottomRowYMm: 0,
      bottomHeightMm: 10,
    }).debug;
    expect(debug).toMatchObject({ layoutId: "layout_6_2_vocs", cols: 4, gutterMm: 4.5, insetMm: 2 });
  });


  it("binds stageplan input ownership to lineup-selected section owner", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {
        drums: { firstName: "Drummer", isBandLeader: false },
        bass: { firstName: "Bassist", isBandLeader: false },
        guitar: { firstName: "Karel", isBandLeader: false },
        keys: { firstName: "Keysman", isBandLeader: false },
        vocs: { firstName: "Lukas", isBandLeader: false },
      },
      leadVocals: [{ firstName: "Lukas", isBandLeader: false }],
      inputs: [
        { channelNo: 1, label: "Acoustic guitar", group: "guitar", ownerRole: "vocs" },
        { channelNo: 2, label: "Electric guitar", group: "guitar", ownerRole: "guitar" },
      ],
      monitorOutputs: [],
      powerByRole: {},
    });

    const guitarBox = plan.boxes.find((box) => box.slot === "guitar");
    const leadBox = plan.boxes.find((box) => box.slot === "lead_voc_1");

    expect(guitarBox?.inputBullets.join(" ")).toContain("Electric guitar");
    expect(guitarBox?.inputBullets.join(" ")).not.toContain("Acoustic guitar");
    expect(leadBox?.inputBullets.join(" ")).toContain("Acoustic guitar");
  });

  it("renders backing track separately from drums and PAD in drums box", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {
        drums: { firstName: "Drummer", isBandLeader: false },
      },
      leadVocals: [{ firstName: "Lead", isBandLeader: false }],
      inputs: [
        { channelNo: 1, label: "Kick OUT", group: "drums" },
        { channelNo: 2, label: "Kick IN", group: "drums" },
        { channelNo: 3, label: "PAD SFX L", group: "drums" },
        { channelNo: 4, label: "PAD SFX R", group: "drums" },
        { channelNo: 5, label: "Backing track L", group: "drums" },
        { channelNo: 6, label: "Backing track R", group: "drums" },
      ],
      monitorOutputs: [],
      powerByRole: {},
    });

    const drumsBox = plan.boxes.find((box) => box.slot === "drums");
    expect(drumsBox?.inputBullets).toEqual(
      expect.arrayContaining(["Drums (1–2)", "PAD SFX (3+4)", "Backing track (5+6)"]),
    );
  });

  it("keeps layout but omits names when hideMusicianNames is enabled", () => {
    const baseVm = {
      lineupByRole: {
        drums: { firstName: "Drummer", isBandLeader: false },
        bass: { firstName: "Bassist", isBandLeader: false },
        guitar: { firstName: "Guitarist", isBandLeader: false },
        keys: { firstName: "Keysman", isBandLeader: false },
      },
      leadVocals: [{ firstName: "Alice", isBandLeader: false }],
      inputs: [],
      monitorOutputs: [],
      powerByRole: {},
    };

    const withNames = buildStageplanPlan(baseVm, { hideMusicianNames: false });
    const hiddenNames = buildStageplanPlan(baseVm, { hideMusicianNames: true });

    expect(withNames.layout.layoutId).toBe(hiddenNames.layout.layoutId);
    expect(withNames.boxes.map((box) => box.position)).toEqual(
      hiddenNames.boxes.map((box) => box.position),
    );
    expect(hiddenNames.boxes.map((box) => box.header)).toEqual(
      expect.arrayContaining(["DRUMS", "BASS", "GUITAR", "LEAD VOC", "KEYS"]),
    );
    expect(hiddenNames.boxes.some((box) => /ALICE|BASSIST|GUITARIST/i.test(box.header))).toBe(false);
  });

  it("keeps stageplan boxes inside stage area and page safe height for layout_6_2_vocs", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {
        drums: { firstName: "Drummer", isBandLeader: false },
        bass: { firstName: "Bassist", isBandLeader: false },
        guitar: { firstName: "Guitarist", isBandLeader: false },
        keys: { firstName: "Keysman", isBandLeader: false },
      },
      leadVocals: [
        { firstName: "Alice", isBandLeader: false },
        { firstName: "Bob", isBandLeader: false },
      ],
      inputs: [
        { channelNo: 1, label: "Guitar", group: "guitar" },
        { channelNo: 2, label: "Lead vocal 1", group: "vocs" },
        { channelNo: 3, label: "Lead vocal 2", group: "vocs" },
        { channelNo: 4, label: "Keys", group: "keys" },
      ],
      monitorOutputs: [],
      powerByRole: {},
    });

    expect(plan.layout.layoutId).toBe("layout_6_2_vocs");
    for (const box of plan.boxes) {
      expect(box.position.xMm).toBeGreaterThanOrEqual(0);
      expect(box.position.yMm).toBeGreaterThanOrEqual(0);
      expect(box.position.xMm + box.position.widthMm).toBeLessThanOrEqual(plan.layout.areaWidthMm);
      expect(box.position.yMm + box.position.heightMm).toBeLessThanOrEqual(plan.layout.areaHeightMm);
    }

    // Rozpočet počítá produkční kód, test ho jen kontroluje — jinak by se
    // vzorec musel držet na dvou místech.
    // Přišpuntěná hodnota, ne nerovnost: úkol 7 tenhle vzorec mění, takže se
    // musí projevit v testu, ne v tichu.
    expect(plan.budget.totalHeightMm).toBeCloseTo(62.1, 1);
    expect(plan.budget.availableHeightMm).toBeCloseTo(
      262 - pdfChromeHeights.headerMm - pdfChromeHeights.footerMm,
      2,
    );
  });

  it("collapses stereo inputs and keeps monitor bullets intact", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {},
      inputs: [
        { channelNo: 1, label: "Kick", group: "drums" },
        { channelNo: 2, label: "Snare", group: "drums" },
        { channelNo: 5, label: "Bass L (main out L)", group: "bass" },
        { channelNo: 6, label: "Bass R (main out R)", group: "bass" },
        { channelNo: 8, label: "OH L", group: "guitar" },
        { channelNo: 9, label: "OH R", group: "guitar" },
        { channelNo: 11, label: "PAD L", group: "drums" },
        { channelNo: 12, label: "PAD R", group: "drums" },
        { channelNo: 15, label: "Keys L", group: "keys" },
        { channelNo: 16, label: "Keys R", group: "keys" },
        { channelNo: 13, label: "Electric guitar L", group: "guitar" },
        { channelNo: 14, label: "Electric guitar R", group: "guitar" },
        { channelNo: 17, label: "Synth", group: "keys" },
        { channelNo: 18, label: "Synth", group: "keys" },
        { channelNo: 19, label: "Synth (mono)", group: "keys" },
      ],
      monitorOutputs: [
        {
          no: 3,
          output: "Drums",
          note: "IEM STEREO wired",
        },
      ],
      powerByRole: {},
    });

    const keysBox = plan.boxes.find((box) => box.instrument === "Keys");
    expect(keysBox?.inputBullets).toEqual(
      expect.arrayContaining(["Keys (15+16)", "Synth (17+18)", "Synth (mono) (19)"])
    );
    expect(keysBox?.inputBullets.join(" ")).not.toContain("Keys L (15)");
    expect(keysBox?.inputBullets.join(" ")).not.toContain("Keys R (16)");

    const guitarBox = plan.boxes.find((box) => box.instrument === "Guitar");
    expect(guitarBox?.inputBullets).toEqual(
      expect.arrayContaining(["OH L (8)", "OH R (9)", "Electric guitar (13+14)"])
    );
    expect(guitarBox?.inputBullets.join(" ")).not.toContain("2x OH");

    const bassBox = plan.boxes.find((box) => box.instrument === "Bass");
    expect(bassBox?.inputBullets).toEqual(expect.arrayContaining(["Bass (5+6)"]));
    expect(bassBox?.inputBullets.join(" ")).not.toContain("Bass L (5)");
    expect(bassBox?.inputBullets.join(" ")).not.toContain("Bass R (6)");

    const drumsBox = plan.boxes.find((box) => box.instrument === "Drums");
    expect(drumsBox?.inputBullets.join(" ")).toContain("PAD (11+12)");
    expect(drumsBox?.monitorBullets).toEqual(
      expect.arrayContaining(["IEM STEREO wired (3)"])
    );
    expect(plan.boxes.flatMap((box) => box.inputBullets).join(" ")).not.toContain("2x ");
  });

  it("renders additional wedge monitor on a separate stageplan line", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {},
      inputs: [],
      monitorOutputs: [
        {
          no: 4,
          output: "Keys",
          note: "IEM STEREO wireless + Additional wedge monitor 1x",
        },
      ],
      powerByRole: {},
    });

    const keysBox = plan.boxes.find((box) => box.instrument === "Keys");
    expect(keysBox?.monitorBullets).toEqual([
      "IEM STEREO wireless (4)",
      "+ Additional wedge monitor 1x",
    ]);
  });


  it("strips FOH-supplied monitor suffixes in stageplan monitor bullets", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {},
      inputs: [],
      monitorOutputs: [
        {
          no: 2,
          output: "Lead vocal",
          note: "Wedge monitor (provided by FOH) + Additional wedge monitor 2x",
        },
      ],
      powerByRole: {},
    });

    const leadBox = plan.boxes.find((box) => box.slot === "lead_voc_1");
    expect(leadBox?.monitorBullets).toEqual([
      "Wedge monitor (2)",
      "+ Additional wedge monitor 2x",
    ]);
  });

  it("strips band-supplied (own) monitor suffixes in stageplan monitor bullets", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {},
      inputs: [],
      monitorOutputs: [
        {
          no: 6,
          output: "Keys",
          note: "IEM STEREO wired (own)",
        },
      ],
      powerByRole: {},
    });

    const keysBox = plan.boxes.find((box) => box.instrument === "Keys");
    expect(keysBox?.monitorBullets).toEqual(["IEM STEREO wired (6)"]);
  });

  it("renders power badges based on stageplan power data", () => {
    const plan = buildStageplanPlan({
      lineupByRole: {},
      inputs: [],
      monitorOutputs: [],
      powerByRole: {
        drums: { hasPowerBadge: true, powerBadgeText: "3x 230 V" },
        keys: { hasPowerBadge: true, powerBadgeText: "5x 230 V" },
        vocs: { hasPowerBadge: false, powerBadgeText: "" },
      },
    });

    const drumsBox = plan.boxes.find((box) => box.instrument === "Drums");
    expect(drumsBox?.hasPowerBadge).toBe(true);
    expect(drumsBox?.powerBadgeText).toBe("3x 230 V");

    const keysBox = plan.boxes.find((box) => box.instrument === "Keys");
    expect(keysBox?.powerBadgeText).toBe("5x 230 V");

    const vocalsBox = plan.boxes.find((box) => box.slot === "lead_voc_1");
    expect(vocalsBox?.hasPowerBadge).toBe(false);
  });
});
