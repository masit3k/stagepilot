import { describe, expect, it } from "vitest";
import { resolveMusicianDisplayName } from "./musicianDisplayName";

describe("resolveMusicianDisplayName", () => {
  it("prefers provided human-readable name", () => {
    expect(
      resolveMusicianDisplayName({
        musicianId: "skalicka_vit",
        preferredName: "Skalická Vít",
      }),
    ).toBe("Skalická Vít");
  });

  it("falls back to humanized id when name is missing", () => {
    expect(
      resolveMusicianDisplayName({
        musicianId: "skalicka_vit",
        preferredName: "",
      }),
    ).toBe("Skalicka Vit");
  });
});
