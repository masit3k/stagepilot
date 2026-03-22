import { describe, expect, it } from "vitest";
import { resolvePersistedTalkbackOwnerId } from "./talkbackPersistence";

describe("resolvePersistedTalkbackOwnerId", () => {
  it("preserves explicit empty-string override for generic edit saves", () => {
    expect(
      resolvePersistedTalkbackOwnerId({
        existingTalkbackOwnerId: "",
        defaultBandLeaderId: "leader-1",
      }),
    ).toBe("");
  });

  it("preserves explicit musician override for generic and event edit saves", () => {
    expect(
      resolvePersistedTalkbackOwnerId({
        existingTalkbackOwnerId: "drummer-1",
        defaultBandLeaderId: "leader-1",
      }),
    ).toBe("drummer-1");
  });

  it("falls back to default band leader when no explicit override exists", () => {
    expect(
      resolvePersistedTalkbackOwnerId({
        existingTalkbackOwnerId: undefined,
        defaultBandLeaderId: "leader-1",
      }),
    ).toBe("leader-1");
  });

  it("prefers default talkback owner from band template before band leader fallback", () => {
    expect(
      resolvePersistedTalkbackOwnerId({
        existingTalkbackOwnerId: undefined,
        defaultTalkbackOwnerId: "talkback-1",
        defaultBandLeaderId: "leader-1",
      }),
    ).toBe("talkback-1");
  });

  it("returns explicit empty value when no explicit override or band leader exists", () => {
    expect(
      resolvePersistedTalkbackOwnerId({
        existingTalkbackOwnerId: undefined,
        defaultBandLeaderId: "",
      }),
    ).toBe("");
  });
});
