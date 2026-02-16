import { describe, expect, it } from "vitest";
import { migrateProjectTalkbackOwner } from "./migrateProjectTalkbackOwner";

describe("migrateProjectTalkbackOwner", () => {
  it("defaults talkback owner to band leader when missing", () => {
    const migrated = migrateProjectTalkbackOwner({
      id: "p-1",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      bandLeaderId: "leader-1",
    });

    expect(migrated.talkbackOwnerId).toBe("leader-1");
  });

  it("keeps explicit talkback owner", () => {
    const migrated = migrateProjectTalkbackOwner({
      id: "p-1",
      purpose: "generic",
      bandRef: "band-1",
      documentDate: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      bandLeaderId: "leader-1",
      talkbackOwnerId: "bass-1",
    });

    expect(migrated.talkbackOwnerId).toBe("bass-1");
  });
});
