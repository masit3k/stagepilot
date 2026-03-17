import { describe, expect, it } from "vitest";
import {
  formatDrumInputDisplayLabel,
  formatLeadVocalDisplayLabel,
  groupActiveDrumInputsByFamily,
} from "./inputLabels.js";

describe("drum input display label compaction", () => {
  it("hides kick number when only one kick is active", () => {
    const inputs = [
      { key: "dr_kick_1_out", label: "Kick 1 OUT", group: "drums" as const },
      { key: "dr_kick_1_in", label: "Kick 1 IN", group: "drums" as const },
    ];
    const state = groupActiveDrumInputsByFamily(inputs);

    expect(formatDrumInputDisplayLabel(inputs[0], state)).toBe("Kick OUT");
    expect(formatDrumInputDisplayLabel(inputs[1], state)).toBe("Kick IN");
  });

  it("shows kick numbering when multiple kicks are active", () => {
    const inputs = [
      { key: "dr_kick_1_out", label: "Kick 1 OUT", group: "drums" as const },
      { key: "dr_kick_2_in", label: "Kick 2 IN", group: "drums" as const },
    ];
    const state = groupActiveDrumInputsByFamily(inputs);

    expect(formatDrumInputDisplayLabel(inputs[0], state)).toBe("Kick 1 OUT");
    expect(formatDrumInputDisplayLabel(inputs[1], state)).toBe("Kick 2 IN");
  });

  it("handles tom/floor/snare single vs multiple numbering", () => {
    const single = [
      { key: "dr_tom_1", label: "Tom 1", group: "drums" as const },
      { key: "dr_floor_1", label: "Floor 1", group: "drums" as const },
      { key: "dr_snare1_top", label: "Snare 1 TOP", group: "drums" as const },
    ];
    const singleState = groupActiveDrumInputsByFamily(single);
    expect(formatDrumInputDisplayLabel(single[0], singleState)).toBe("Tom");
    expect(formatDrumInputDisplayLabel(single[1], singleState)).toBe("Floor");
    expect(formatDrumInputDisplayLabel(single[2], singleState)).toBe("Snare TOP");

    const multi = [
      { key: "dr_tom_1", label: "Tom 1", group: "drums" as const },
      { key: "dr_tom_2", label: "Tom 2", group: "drums" as const },
      { key: "dr_floor_1", label: "Floor 1", group: "drums" as const },
      { key: "dr_floor_2", label: "Floor 2", group: "drums" as const },
      { key: "dr_snare1_bottom", label: "Snare 1 BOTTOM", group: "drums" as const },
      { key: "dr_snare2_bottom", label: "Snare 2 BOTTOM", group: "drums" as const },
    ];
    const multiState = groupActiveDrumInputsByFamily(multi);
    expect(formatDrumInputDisplayLabel(multi[0], multiState)).toBe("Tom 1");
    expect(formatDrumInputDisplayLabel(multi[1], multiState)).toBe("Tom 2");
    expect(formatDrumInputDisplayLabel(multi[2], multiState)).toBe("Floor 1");
    expect(formatDrumInputDisplayLabel(multi[3], multiState)).toBe("Floor 2");
    expect(formatDrumInputDisplayLabel(multi[4], multiState)).toBe("Snare 1 BOTTOM");
    expect(formatDrumInputDisplayLabel(multi[5], multiState)).toBe("Snare 2 BOTTOM");
  });
});

describe("lead vocal input list formatting", () => {
  it("renders uppercase gender suffix without parentheses for multi-lead", () => {
    expect(
      formatLeadVocalDisplayLabel({
        key: "voc_lead_1",
        fallbackLabel: "Lead vocal 1",
        leadCount: 2,
        leadGenderByIndex: ["m", "f"],
      }),
    ).toBe("Lead vocal 1 MALE");

    expect(
      formatLeadVocalDisplayLabel({
        key: "voc_lead_2",
        fallbackLabel: "Lead vocal 2",
        leadCount: 2,
        leadGenderByIndex: ["m", "f"],
      }),
    ).toBe("Lead vocal 2 FEMALE");
  });
});
