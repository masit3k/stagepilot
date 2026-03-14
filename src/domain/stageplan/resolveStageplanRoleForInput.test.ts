import { describe, expect, it } from "vitest";
import { resolveStageplanRoleForInput } from "./resolveStageplanRoleForInput";

describe("resolveStageplanRoleForInput", () => {
  it("maps acoustic guitar to Guitar even when group differs", () => {
    expect(
      resolveStageplanRoleForInput({
        key: "ac_guitar",
        label: "Acoustic guitar",
        group: "vocs",
      }),
    ).toBe("Guitar");
  });

  it("keeps lead vocal mapping", () => {
    expect(
      resolveStageplanRoleForInput({
        key: "voc_lead",
        label: "Lead vocal",
        group: "vocs",
      }),
    ).toBe("Lead vocal");
  });
});
