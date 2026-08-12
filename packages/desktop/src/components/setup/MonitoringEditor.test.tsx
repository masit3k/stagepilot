import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Monitor } from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import {
  MAX_ADDITIONAL_WEDGE_COUNT,
  MIN_ADDITIONAL_WEDGE_COUNT,
  MonitoringEditor,
  clampAdditionalWedgeCount,
  isAdditionalWedgeEnabled,
  isMonitoringFieldModified,
} from "./MonitoringEditor";

const MONITORS: Monitor[] = [
  {
    type: "monitor",
    id: "iem_stereo_wired_foh",
    label: "IEM STEREO wired (provided by FOH)",
    kind: "iem",
    supplier: "foh",
    mode: "stereo",
    wireless: false,
  },
  {
    type: "monitor",
    id: "iem_stereo_wired_own",
    label: "IEM STEREO wired (own)",
    kind: "iem",
    supplier: "band",
    mode: "stereo",
    wireless: false,
  },
  {
    type: "monitor",
    id: "wedge_foh",
    label: "Wedge monitor (provided by FOH)",
    kind: "wedge",
    supplier: "foh",
  },
  {
    type: "monitor",
    id: "wedge_own",
    label: "Wedge monitor (own)",
    kind: "wedge",
    supplier: "band",
  },
];

const baseMonitoring = { monitorRef: "wedge_foh" };

const baseDiffMeta: SetupDiffMeta = {
  inputs: [],
  monitoring: {
    monitorRef: { origin: "default", changeType: "unchanged" },
    additionalWedgeCount: { origin: "default", changeType: "unchanged" },
  },
};

describe("MonitoringEditor", () => {
  it("renders one dropdown entry per monitor type, without supplier suffixes", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={baseMonitoring}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain('value="iem:stereo:wired"');
    expect(html).toContain(">IEM STEREO wired<");
    expect(html).toContain('value="wedge"');
    expect(html).not.toContain("(provided by FOH)");
  });

  it("renders the supplier switch with the effective supplier selected", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={{ monitorRef: "iem_stereo_wired_own" }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain('aria-label="Dodavatel odposlechu"');
    expect(html).toContain("Vlastní");
    expect(html).toContain("Pořadatel");
    expect(html).toContain('aria-pressed="true"');
  });

  it("resolves a legacy monitor ref instead of showing an empty selection", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={{ monitorRef: "wedge" }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain('value="wedge" selected=""');
    expect(html).not.toContain("No monitor selected");
  });

  it("shows an empty selection when the ref is unknown", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={{ monitorRef: "missing_monitor" }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain("No monitor selected");
  });

  it("keeps the additional wedge toggle and stepper", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={{ ...baseMonitoring, additionalWedgeCount: 2 }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain(
      '<span class="setup-toggle-row__text">Additional wedge monitor</span>',
    );
    expect(html).toContain("setup-stepper__btn");
    expect(html).toContain('aria-label="Decrease Additional wedges"');
  });

  it("adds the shared modified field class when the monitor origin is override", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        monitors={MONITORS}
        effectiveMonitoring={baseMonitoring}
        diffMeta={{
          ...baseDiffMeta,
          monitoring: {
            ...baseDiffMeta.monitoring,
            monitorRef: { origin: "override", changeType: "added" },
          },
        }}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain("setup-field-block setup-field-block--modified");
  });
});

describe("monitoring helper rules", () => {
  it("normalizes additional wedge enabled state", () => {
    expect(isAdditionalWedgeEnabled(undefined)).toBe(false);
    expect(isAdditionalWedgeEnabled(0)).toBe(false);
    expect(isAdditionalWedgeEnabled(1)).toBe(true);
  });

  it("clamps additional wedge count to configured limits", () => {
    expect(clampAdditionalWedgeCount(0)).toBe(MIN_ADDITIONAL_WEDGE_COUNT);
    expect(clampAdditionalWedgeCount(3)).toBe(3);
    expect(clampAdditionalWedgeCount(8)).toBe(MAX_ADDITIONAL_WEDGE_COUNT);
  });

  it("uses override origin as the canonical field-modified signal", () => {
    expect(isMonitoringFieldModified("default")).toBe(false);
    expect(isMonitoringFieldModified("override")).toBe(true);
  });
});
