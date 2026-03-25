import { describe, expect, it } from "vitest";
import { resolveStageplanRoleForInput } from "./resolveStageplanRoleForInput.js";

describe("resolveStageplanRoleForInput", () => {
  it("uses ownerRole as primary stageplan instrument mapping", () => {
    expect(resolveStageplanRoleForInput({ label: "Anything", ownerRole: "drums" })).toBe("Drums");
    expect(resolveStageplanRoleForInput({ label: "Anything", ownerRole: "keys" })).toBe("Keys");
  });

  it("falls back to group and acoustic guitar key mapping", () => {
    expect(resolveStageplanRoleForInput({ label: "Acoustic Guitar", key: "ac_guitar_sm", group: "vocs" })).toBe("Guitar");
    expect(resolveStageplanRoleForInput({ label: "Bass DI", group: "bass" })).toBe("Bass");
  });
});
