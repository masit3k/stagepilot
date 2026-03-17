import { describe, expect, it } from "vitest";

import { getDrumSetupBlueprintPath } from "./assetsPaths.js";

describe("assetsPaths", () => {
  it("resolves canonical drums setup blueprint path", () => {
    expect(getDrumSetupBlueprintPath("/repo/data")).toBe("/repo/data/assets/setup-blueprints/drums.json");
  });
});
