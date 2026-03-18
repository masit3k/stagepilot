import { describe, expect, it } from "vitest";
import { migrateBandDefaultLineupVocs, withLegacyVocalMembershipInDefaultLineup } from "./defaultLineupVocs";

describe("withLegacyVocalMembershipInDefaultLineup", () => {
  it("keeps existing vocs and appends legacy lead vocal keys without duplicates", () => {
    const normalized = withLegacyVocalMembershipInDefaultLineup({
      vocs: ["voc-existing", "voc-lead"],
      lead_vocs: ["voc-lead", "voc-other"],
      lead_voc: "voc-old",
    });

    expect(normalized.vocs).toEqual(["voc-existing", "voc-lead", "voc-other", "voc-old"]);
  });

  it("uses legacy lead_vocs as fallback when vocs are missing", () => {
    const normalized = withLegacyVocalMembershipInDefaultLineup({ lead_vocs: ["voc-1", "voc-2"] });
    expect(normalized.vocs).toEqual(["voc-1", "voc-2"]);
  });
});

describe("migrateBandDefaultLineupVocs", () => {
  it("adds selected lead/back vocal members with group=vocs", () => {
    const migrated = migrateBandDefaultLineupVocs({
      defaultLineup: {
        vocs: ["voc-existing"],
        lead_vocs: ["voc-existing", "voc-new"],
        back_vocs: ["voc-back", "keys-1"],
      },
      resolveMusicianGroup: (id) => {
        if (id === "voc-existing" || id === "voc-new" || id === "voc-back") return "vocs";
        if (id === "keys-1") return "keys";
        return undefined;
      },
    });

    expect(migrated.defaultLineup.vocs).toEqual(["voc-existing", "voc-new", "voc-back"]);
    expect(migrated.addedVocalMembers).toEqual(["voc-new", "voc-back"]);
    expect(migrated.changed).toBe(true);
  });

  it("is idempotent when rerun", () => {
    const first = migrateBandDefaultLineupVocs({
      defaultLineup: {
        lead_vocs: ["voc-1"],
        back_vocs: ["voc-2"],
      },
      resolveMusicianGroup: () => "vocs",
    });

    const second = migrateBandDefaultLineupVocs({
      defaultLineup: first.defaultLineup,
      resolveMusicianGroup: () => "vocs",
    });

    expect(first.defaultLineup.vocs).toEqual(["voc-1", "voc-2"]);
    expect(second.changed).toBe(false);
    expect(second.addedVocalMembers).toEqual([]);
  });

  it("does not add missing or non-vocs musicians", () => {
    const migrated = migrateBandDefaultLineupVocs({
      defaultLineup: {
        lead_vocs: ["keys-1", "missing"],
      },
      resolveMusicianGroup: (id) => (id === "keys-1" ? "keys" : undefined),
    });

    expect(migrated.defaultLineup.vocs).toBeUndefined();
    expect(migrated.addedVocalMembers).toEqual([]);
    expect(migrated.changed).toBe(false);
  });
});
