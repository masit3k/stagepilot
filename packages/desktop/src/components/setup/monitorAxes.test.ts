import { describe, expect, it } from "vitest";
import type { Monitor } from "../../../../../src/domain/model/types";
import {
  buildMonitorAxes,
  resolveMonitorRef,
  resolveMonitorSelection,
} from "./monitorAxes";

const iem = (
  id: string,
  label: string,
  supplier: "band" | "foh",
  mode: "mono" | "stereo",
  wireless: boolean,
): Monitor => ({
  type: "monitor",
  id,
  label,
  kind: "iem",
  supplier,
  mode,
  wireless,
});

const wedge = (
  id: string,
  label: string,
  supplier: "band" | "foh",
): Monitor => ({
  type: "monitor",
  id,
  label,
  kind: "wedge",
  supplier,
});

const CATALOG: Monitor[] = [
  iem(
    "iem_stereo_wired_foh",
    "IEM STEREO wired (provided by FOH)",
    "foh",
    "stereo",
    false,
  ),
  iem(
    "iem_stereo_wired_own",
    "IEM STEREO wired (own)",
    "band",
    "stereo",
    false,
  ),
  iem(
    "iem_mono_wireless_foh",
    "IEM MONO wireless (provided by FOH)",
    "foh",
    "mono",
    true,
  ),
  iem("iem_mono_wireless_own", "IEM MONO wireless (own)", "band", "mono", true),
  wedge("wedge_foh", "Wedge monitor (provided by FOH)", "foh"),
  wedge("wedge_own", "Wedge monitor (own)", "band"),
];

describe("buildMonitorAxes", () => {
  it("collapses supplier variants into one option per type", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(axes.types.map((t) => t.key)).toEqual([
      "iem:mono:wireless",
      "iem:stereo:wired",
      "wedge",
    ]);
  });

  it("strips the supplier suffix from type labels", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(axes.types.map((t) => t.label)).toEqual([
      "IEM MONO wireless",
      "IEM STEREO wired",
      "Wedge monitor",
    ]);
  });
});

describe("resolveMonitorSelection", () => {
  it("maps a monitor ref onto both axes", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorSelection(axes, "iem_stereo_wired_own")).toEqual({
      typeKey: "iem:stereo:wired",
      supplier: "band",
    });
  });

  it("resolves a legacy monitor ref through the alias map", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorSelection(axes, "wedge")).toEqual({
      typeKey: "wedge",
      supplier: "foh",
    });
  });

  it("returns undefined for an unknown ref", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorSelection(axes, "nonsense")).toBeUndefined();
  });
});

describe("resolveMonitorRef", () => {
  it("keeps the supplier when the type changes", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorRef(axes, "wedge", "band")).toBe("wedge_own");
  });

  it("keeps the type when the supplier changes", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorRef(axes, "iem:stereo:wired", "foh")).toBe(
      "iem_stereo_wired_foh",
    );
  });

  it("falls back to the other supplier when the combination is missing", () => {
    const partial = buildMonitorAxes([
      iem(
        "iem_stereo_wired_foh",
        "IEM STEREO wired (provided by FOH)",
        "foh",
        "stereo",
        false,
      ),
    ]);
    expect(resolveMonitorRef(partial, "iem:stereo:wired", "band")).toBe(
      "iem_stereo_wired_foh",
    );
  });

  it("returns undefined for an unknown type key", () => {
    const axes = buildMonitorAxes(CATALOG);
    expect(resolveMonitorRef(axes, "nonsense", "band")).toBeUndefined();
  });
});
