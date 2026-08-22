import { describe, expect, it } from "vitest";
import { resolveMonitorRowEditability } from "./resolveMonitorRowEditability";

describe("resolveMonitorRowEditability", () => {
  it("allows editing any slot that exists in the lineup", () => {
    for (const ownerRole of [
      "drums",
      "bass",
      "guitar",
      "keys",
      "vocs",
    ] as const) {
      expect(
        resolveMonitorRowEditability({ slotKey: `${ownerRole}:0`, ownerRole }),
      ).toEqual({ canEdit: true });
    }
  });

  it("allows a drums slot now that the document reads its monitoring override (F5d R3)", () => {
    expect(
      resolveMonitorRowEditability({ slotKey: "drums:0", ownerRole: "drums" }),
    ).toEqual({ canEdit: true });
  });

  it("refuses an owner with no lineup slot regardless of role", () => {
    expect(
      resolveMonitorRowEditability({ slotKey: "", ownerRole: "bass" }),
    ).toEqual({ canEdit: false, reason: "no-slot" });
  });

  it("refuses a drums owner with no lineup slot", () => {
    expect(
      resolveMonitorRowEditability({ slotKey: "", ownerRole: "drums" }),
    ).toEqual({ canEdit: false, reason: "no-slot" });
  });
});
