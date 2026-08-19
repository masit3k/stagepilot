import { describe, expect, it } from "vitest";
import type { LineupSlotValue } from "../../../projectRules";
import { resetInputsScreen } from "./resetInputsScreen";

/**
 * `lineup.drums` is typed as `RichLineupValue` (string | slot | array of
 * either) so indexing it with a fixed slot number does not type-check on its
 * own. Every fixture in this file puts an object slot in `drums`, so the
 * narrowing here is safe for the tests that use it.
 */
function firstDrumSlot(
  result: ReturnType<typeof resetInputsScreen>,
): LineupSlotValue | undefined {
  const drums = result.lineup?.drums;
  return Array.isArray(drums) ? (drums[0] as LineupSlotValue) : undefined;
}

const payload = {
  id: "p1",
  purpose: "event" as const,
  bandRef: "b1",
  documentDate: "2026-08-22",
  createdAt: "2026-08-01T00:00:00.000Z",
  inputOrder: ["kick_in"],
  notes: { disabled: ["x"] },
  lineup: {
    drums: [
      {
        musicianId: "m1",
        presetOverride: {
          inputs: { remove: ["a"], update: [{ key: "b", label: "B" }] },
          monitoring: { monitorRef: "iem" },
        },
        drumDefinition: { toms: 3 },
      },
    ],
  },
};

describe("resetInputsScreen", () => {
  it("drops the manual input order", () => {
    expect(resetInputsScreen(payload as never).inputOrder).toBeUndefined();
  });

  it("drops notes deviations", () => {
    expect(resetInputsScreen(payload as never).notes).toBeUndefined();
  });

  it("drops slot preset overrides including monitoring", () => {
    const slot = firstDrumSlot(resetInputsScreen(payload as never));

    expect(slot?.presetOverride).toBeUndefined();
  });

  it("drops the drum definition, because it is a deviation too", () => {
    const slot = firstDrumSlot(resetInputsScreen(payload as never));

    expect(slot?.drumDefinition).toBeUndefined();
  });

  it("keeps the musician in the slot", () => {
    const slot = firstDrumSlot(resetInputsScreen(payload as never));

    expect(slot?.musicianId).toBe("m1");
  });

  it("keeps everything outside the screen untouched", () => {
    const reset = resetInputsScreen({
      ...payload,
      eventVenue: "Zámek Bon Repos",
      stageplan: { layout: { blocks: [] } },
    } as never);

    expect(reset.eventVenue).toBe("Zámek Bon Repos");
    expect(reset.stageplan).toEqual({ layout: { blocks: [] } });
  });

  it("does not mutate the incoming payload", () => {
    const original = structuredClone(payload);
    resetInputsScreen(payload as never);

    expect(payload).toEqual(original);
  });

  it("keeps a plain-string lineup entry as-is (no override to strip)", () => {
    // serializeLineupForProject stores a role as bare musicianId strings once
    // no slot in it carries an override — reset must not turn that back into
    // an empty musicianId.
    const stringLineup = {
      ...payload,
      lineup: { bass: ["m2"] },
    };

    const reset = resetInputsScreen(stringLineup as never);

    expect(reset.lineup?.bass).toEqual(["m2"]);
  });

  it("strips overrides from a non-array (single-slot) lineup entry", () => {
    const singleSlotLineup = {
      ...payload,
      lineup: {
        drums: {
          musicianId: "m3",
          presetOverride: { inputs: { remove: ["a"] } },
        },
      },
    };

    const reset = resetInputsScreen(singleSlotLineup as never);

    expect(reset.lineup?.drums).toEqual({ musicianId: "m3" });
  });
});
