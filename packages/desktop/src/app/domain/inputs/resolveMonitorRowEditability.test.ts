import { describe, expect, it } from "vitest";
import { resolveMonitorRowEditability } from "./resolveMonitorRowEditability";

describe("resolveMonitorRowEditability", () => {
  it("allows editing a bass/guitar/keys/vocs slot", () => {
    for (const ownerRole of ["bass", "guitar", "keys", "vocs"] as const) {
      expect(
        resolveMonitorRowEditability({ slotKey: `${ownerRole}:0`, ownerRole }),
      ).toEqual({ canEdit: true });
    }
  });

  it("refuses drums even with a valid slot — the document ignores the patch (task 12c fix round 1)", () => {
    expect(
      resolveMonitorRowEditability({ slotKey: "drums:0", ownerRole: "drums" }),
    ).toEqual({ canEdit: false, reason: "drums-not-supported" });
  });

  it("refuses an owner with no lineup slot regardless of role", () => {
    expect(
      resolveMonitorRowEditability({ slotKey: "", ownerRole: "bass" }),
    ).toEqual({ canEdit: false, reason: "no-slot" });
  });

  it("reports no-slot when both conditions hold", () => {
    expect(
      resolveMonitorRowEditability({ slotKey: "", ownerRole: "drums" }),
    ).toEqual({ canEdit: false, reason: "no-slot" });
  });
});
