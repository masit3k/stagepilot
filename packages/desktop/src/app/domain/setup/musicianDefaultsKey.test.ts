import { describe, expect, it } from "vitest";
import { musicianDefaultsKey } from "./musicianDefaultsKey";

describe("musicianDefaultsKey", () => {
  it("joins the musician id and role with a colon", () => {
    expect(musicianDefaultsKey("m1", "bass")).toBe("m1:bass");
  });

  it("keeps musician id and role in stable order, not merged", () => {
    expect(musicianDefaultsKey("bass", "m1")).toBe("bass:m1");
  });
});
