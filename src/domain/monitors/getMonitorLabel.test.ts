import { describe, expect, it } from "vitest";
import { getMonitorLabel } from "./getMonitorLabel.js";

describe("getMonitorLabel", () => {
  it("returns label from monitor preset index", () => {
    expect(getMonitorLabel({ iem_stereo_wired_foh: { id: "iem_stereo_wired_foh", label: "IEM STEREO wired" } }, "iem_stereo_wired_foh")).toBe("IEM STEREO wired");
  });
});
