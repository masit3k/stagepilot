import { describe, expect, it } from "vitest";
import { getMonitorLabel } from "./getMonitorLabel.js";

describe("getMonitorLabel", () => {
  it("returns label from monitor preset index", () => {
    expect(getMonitorLabel({ iem_stereo_wired: { id: "iem_stereo_wired", label: "IEM STEREO wired" } }, "iem_stereo_wired")).toBe("IEM STEREO wired");
  });
});
