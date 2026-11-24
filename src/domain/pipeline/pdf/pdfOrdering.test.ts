import { describe, expect, it } from "vitest";
import type { Group } from "../../model/groups.js";
import type { Musician } from "../../model/types.js";
import { buildDefaultLayout } from "../../stageplan/layout/defaultLayout.js";
import {
  TALKBACK_POSITION_RANK,
  resolveStagePositionRankByRole,
} from "../../stageplan/resolveStagePositionOrder.js";
import {
  type MonitorOwner,
  orderPdfMonitorOwners,
} from "./buildPdfMonitorRows.js";
import { comparePdfInputs, composeFinalPdfInputOrder } from "./pdfOrdering.js";

/** Výchozí rozmístění pěti bloků — hada z něj čte `resolveStagePositionOrder`. */
const DEFAULT_RANK_BY_ROLE = resolveStagePositionRankByRole(
  buildDefaultLayout({
    slots: ["drums", "bass", "guitar", "keys", "lead_voc_1"],
    stage: null,
  }),
);

type SortableInput = {
  key: string;
  label: string;
  group: Group;
  ownerRole: Group;
  ownerMusicianId?: string;
  ownerLineupIndex?: number;
  vocalRole?: "lead" | "back";
  vocalSlot?: number;
  vocalOrderRank?: number;
};

function input(
  key: string,
  group: Group,
  overrides: Partial<SortableInput> = {},
): SortableInput {
  return { key, label: key, group, ownerRole: group, ...overrides };
}

function makeMusician(id: string, group: Group): Musician {
  return { id, firstName: id, lastName: id, group, presets: [] };
}

function owner(id: string, group: Group): MonitorOwner {
  return { group, musician: makeMusician(id, group) };
}

/* ------------------------------------------------------------------ */
describe("composeFinalPdfInputOrder — block composition", () => {
  it("places non-vocal/non-talkback inputs first", () => {
    const inputs = [
      input("voc_lead_1", "vocs", { vocalRole: "lead" }),
      input("kick", "drums"),
      input("tb_1", "talkback"),
      input("el_bass", "bass"),
    ];
    const result = composeFinalPdfInputOrder(inputs, new Map(), new Map());
    expect(result.map((i) => i.group)).toEqual([
      "drums",
      "bass",
      "vocs",
      "talkback",
    ]);
  });

  it("places vocals before talkback", () => {
    const inputs = [
      input("tb_1", "talkback"),
      input("voc_back_guitar_1", "vocs", { vocalRole: "back" }),
      input("voc_lead_1", "vocs", { vocalRole: "lead" }),
    ];
    const result = composeFinalPdfInputOrder(inputs, new Map(), new Map());
    expect(result[0].key).toBe("voc_lead_1");
    expect(result[1].key).toBe("voc_back_guitar_1");
    expect(result[2].key).toBe("tb_1");
  });

  it("places talkback last when only instruments and talkback are present", () => {
    const inputs = [input("tb_1", "talkback"), input("kick", "drums")];
    const result = composeFinalPdfInputOrder(inputs, new Map(), new Map());
    expect(result[0].group).toBe("drums");
    expect(result[1].group).toBe("talkback");
  });
});

/* ------------------------------------------------------------------ */
describe("comparePdfInputs — group order", () => {
  it("orders drums before bass", () => {
    const drum = input("kick", "drums");
    const bass = input("el_bass", "bass");
    expect(comparePdfInputs(drum, bass)).toBeLessThan(0);
    expect(comparePdfInputs(bass, drum)).toBeGreaterThan(0);
  });

  it("orders bass before guitar", () => {
    expect(
      comparePdfInputs(input("el_bass", "bass"), input("el_guitar", "guitar")),
    ).toBeLessThan(0);
  });

  it("orders guitar before keys", () => {
    expect(
      comparePdfInputs(input("el_guitar", "guitar"), input("keys_1", "keys")),
    ).toBeLessThan(0);
  });

  it("returns 0 for identical inputs (stable comparator)", () => {
    const a = input("kick", "drums");
    expect(comparePdfInputs(a, a)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe("orderPdfMonitorOwners — order follows the position on stage", () => {
  it("reads the default layout as guitar → vocs → keys → bass → drums", () => {
    const owners = [
      owner("drm", "drums"),
      owner("keys", "keys"),
      owner("voc", "vocs"),
      owner("bass", "bass"),
      owner("gtr", "guitar"),
    ];
    const result = orderPdfMonitorOwners({
      owners,
      leadVocsSlotByMusicianId: new Map(),
      stagePositionRankByRole: DEFAULT_RANK_BY_ROLE,
    });
    expect(result.map((o) => o.group)).toEqual([
      "guitar",
      "vocs",
      "keys",
      "bass",
      "drums",
    ]);
  });

  it("follows the blocks once the user moves them, instead of a fixed group table", () => {
    // Zrcadlové rozmístění: kytara vpravo, klávesy vlevo. První řada se čte
    // zleva doprava, takže klávesy jdou před kytaru — pevná tabulka pořadí
    // skupin by tuhle změnu nikdy nezaznamenala.
    const mirrored = resolveStagePositionRankByRole({
      stage: null,
      blocks: [
        { slot: "drums", centerXM: 6, centerYM: 1.2, widthM: 2.8, depthM: 1.6, rotationDeg: 0 },
        { slot: "bass", centerXM: 2.6, centerYM: 1.2, widthM: 2.7, depthM: 1.4, rotationDeg: 0 },
        { slot: "keys", centerXM: 2.6, centerYM: 5.5, widthM: 2.8, depthM: 1.4, rotationDeg: 0 },
        { slot: "guitar", centerXM: 9.4, centerYM: 5.5, widthM: 2.7, depthM: 1.4, rotationDeg: 0 },
        { slot: "lead_voc_1", centerXM: 6, centerYM: 5.5, widthM: 2.6, depthM: 1.2, rotationDeg: 0 },
      ],
    });
    const owners = [
      owner("drm", "drums"),
      owner("keys", "keys"),
      owner("voc", "vocs"),
      owner("bass", "bass"),
      owner("gtr", "guitar"),
    ];
    const result = orderPdfMonitorOwners({
      owners,
      leadVocsSlotByMusicianId: new Map(),
      stagePositionRankByRole: mirrored,
    });
    expect(result.map((o) => o.group)).toEqual([
      "keys",
      "vocs",
      "guitar",
      "drums",
      "bass",
    ]);
  });

  it("places vocs lead-slot owner before non-lead vocs owner", () => {
    const owners = [owner("voc-back", "vocs"), owner("voc-lead-1", "vocs")];
    const result = orderPdfMonitorOwners({
      owners,
      leadVocsSlotByMusicianId: new Map([["voc-lead-1", 1]]),
      stagePositionRankByRole: DEFAULT_RANK_BY_ROLE,
    });
    expect(result[0].musician.id).toBe("voc-lead-1");
    expect(result[1].musician.id).toBe("voc-back");
  });

  it("preserves original order for equal-rank owners (stable fallback)", () => {
    const owners = [owner("keys-a", "keys"), owner("keys-b", "keys")];
    const result = orderPdfMonitorOwners({
      owners,
      leadVocsSlotByMusicianId: new Map(),
      stagePositionRankByRole: DEFAULT_RANK_BY_ROLE,
    });
    expect(result[0].musician.id).toBe("keys-a");
    expect(result[1].musician.id).toBe("keys-b");
  });

  it("ranks talkback last — it has no block on the stage plan", () => {
    expect(DEFAULT_RANK_BY_ROLE.get("talkback")).toBe(TALKBACK_POSITION_RANK);
    const owners = [owner("tb", "talkback"), owner("drm", "drums")];
    const result = orderPdfMonitorOwners({
      owners,
      leadVocsSlotByMusicianId: new Map(),
      stagePositionRankByRole: DEFAULT_RANK_BY_ROLE,
    });
    expect(result.map((o) => o.group)).toEqual(["drums", "talkback"]);
  });
});
