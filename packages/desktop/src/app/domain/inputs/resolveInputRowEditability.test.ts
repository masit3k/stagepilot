import { describe, expect, it } from "vitest";
import { resolveInputRowEditability } from "./resolveInputRowEditability";

describe("resolveInputRowEditability", () => {
  it("allows a plain bass/guitar/keys instrument row", () => {
    for (const role of ["bass", "guitar", "keys"] as const) {
      expect(
        resolveInputRowEditability({ ownerRole: role, group: role }),
      ).toEqual({ canEdit: true });
    }
  });

  // Ruling (task 13b): `resolveEffectiveProjectSetup` reads only
  // `inputs.update` for a drums slot (task 12c fix round 1) — an `add`/
  // `remove` written from screen 02 never reaches the printed document, and
  // for `remove` specifically the row would strike through as if it worked.
  it("refuses a drums-owned row even though it looks like a plain instrument row", () => {
    expect(
      resolveInputRowEditability({ ownerRole: "drums", group: "drums" }),
    ).toEqual({ canEdit: false, reason: "drums-not-supported" });
  });

  // Ruling (task 13b): the criterion is the row's own `group`, not its
  // `ownerRole` — a back-vocal overlay row owned by a bassist/guitarist/
  // keyboardist carries `ownerRole` for their instrument but `group: "vocs"`.
  it("refuses a vocal overlay row owned by an instrumentalist, keyed by group not ownerRole", () => {
    expect(
      resolveInputRowEditability({ ownerRole: "bass", group: "vocs" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
    expect(
      resolveInputRowEditability({ ownerRole: "guitar", group: "vocs" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
    expect(
      resolveInputRowEditability({ ownerRole: "keys", group: "vocs" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
  });

  // Fix round 2, Important 1: a drummer's own back-vocal overlay row
  // (`voc_back_drums_1`) carries `ownerRole: "drums"` AND `group: "vocs"` —
  // it is not a drum-kit channel. `group` must win, or this row gets
  // `drums-not-supported`, which (since task 16) feeds an enabled `Edit kit`
  // action and a hint claiming "Drum kit channels change through Edit kit" —
  // an active false steer, since editing the kit never touches this row.
  it("refuses a drummer's own back-vocal overlay row as an overlay row, not a drums row", () => {
    expect(
      resolveInputRowEditability({ ownerRole: "drums", group: "vocs" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
  });

  it("refuses a lead/back vocal row owned by a pure vocs slot", () => {
    expect(
      resolveInputRowEditability({ ownerRole: "vocs", group: "vocs" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
  });

  it("refuses the talkback row regardless of the owner's instrument role", () => {
    expect(
      resolveInputRowEditability({ ownerRole: "bass", group: "talkback" }),
    ).toEqual({ canEdit: false, reason: "overlay-not-supported" });
  });

  // The two-step `+ Add input` picker used to ask this same question about a
  // not-yet-existing row and died with F5d R5. The shape it asked in — `group`
  // equal to `ownerRole` — is still the shape of every plain instrument-owned
  // row, so this case stays as the gate's summary over all five lineup roles.
  it("refuses drums and vocs, allows bass/guitar/keys, keyed by role", () => {
    expect(
      resolveInputRowEditability({ ownerRole: "drums", group: "drums" })
        .canEdit,
    ).toBe(false);
    expect(
      resolveInputRowEditability({ ownerRole: "vocs", group: "vocs" }).canEdit,
    ).toBe(false);
    for (const role of ["bass", "guitar", "keys"] as const) {
      expect(
        resolveInputRowEditability({ ownerRole: role, group: role }).canEdit,
      ).toBe(true);
    }
  });
});
