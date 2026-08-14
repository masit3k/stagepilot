import { describe, expect, it } from "vitest";
import {
  formatMonitorBullet,
  formatMonitorBullets,
  formatStageplanBoxHeader,
} from "./stageplan.js";

describe("formatStageplanBoxHeader", () => {
  it("formats uppercase header with en dash", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Guitar",
      firstName: "Matěj",
    });

    expect(label).toBe("GUITAR – MATĚJ");
  });

  it("omits name when missing", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Lead vocal",
    });

    expect(label).toBe("LEAD VOC");
  });

  it("marks the band leader with a footnote asterisk and no space", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Bass",
      firstName: "Matěj",
      isBandLeader: true,
    });

    expect(label).toBe("BASS – MATĚJ*");
  });

  it("keeps the asterisk when musician names are hidden", () => {
    // DRUMS* je pořád pravdivá informace o tom, kdo je kapelník (R12).
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Drums",
      firstName: "Matěj",
      isBandLeader: true,
      hideMusicianNames: true,
    });

    expect(label).toBe("DRUMS*");
  });

  it("hides musician names when requested", () => {
    const label = formatStageplanBoxHeader({
      instrumentLabel: "Bass",
      firstName: "Matěj",
      hideMusicianNames: true,
    });

    expect(label).toBe("BASS");
  });
});

describe("formatMonitorBullet", () => {
  it("formats monitor note with output number", () => {
    expect(formatMonitorBullet("IEM A", 3)).toBe("IEM A (3)");
  });

  it("falls back to number when note is empty", () => {
    expect(formatMonitorBullet("", 4)).toBe("(4)");
  });
});

describe("formatMonitorBullets", () => {
  it("keeps a single line when no additional wedge monitor is present", () => {
    expect(formatMonitorBullets("IEM STEREO wireless", 4)).toEqual([
      "IEM STEREO wireless (4)",
    ]);
  });

  it("splits additional wedge monitor to a dedicated line", () => {
    expect(
      formatMonitorBullets(
        "IEM STEREO wireless + Additional wedge monitor 1x",
        4,
      ),
    ).toEqual(["IEM STEREO wireless (4)", "+ Additional wedge monitor 1x"]);
  });

  it("strips the FOH-supplied suffix from the base label", () => {
    expect(
      formatMonitorBullets("IEM STEREO wired (provided by FOH)", 5),
    ).toEqual(["IEM STEREO wired (5)"]);
  });

  it("strips the band-supplied (own) suffix from the base label", () => {
    expect(formatMonitorBullets("Wedge monitor (own)", 2)).toEqual([
      "Wedge monitor (2)",
    ]);
  });
});
