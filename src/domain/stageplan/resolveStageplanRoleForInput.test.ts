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

  it("prefers lineup owner role over preset group for non-special inputs", () => {
    expect(
      resolveStageplanRoleForInput({
        key: "ac_guitar",
        label: "Acoustic guitar",
        group: "guitar",
        ownerRole: "vocs",
      }),
    ).toBe("Lead vocal");
  });

  it("keeps back-vocal ownership mapping", () => {
    expect(
      resolveStageplanRoleForInput({
        key: "voc_back_drums",
        label: "Back vocal - drums",
        group: "vocs",
        ownerRole: "vocs",
      }),
    ).toBe("Drums");
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
