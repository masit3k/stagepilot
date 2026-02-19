import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import {
  MAX_ADDITIONAL_WEDGE_COUNT,
  MIN_ADDITIONAL_WEDGE_COUNT,
  MonitoringEditor,
  clampAdditionalWedgeCount,
  isAdditionalWedgeEnabled,
  isMonitoringFieldModified,
} from "./MonitoringEditor";

const baseMonitoring = { monitorRef: "wedge" };

const baseDiffMeta: SetupDiffMeta = {
  inputs: [],
  monitoring: {
    monitorRef: { origin: "default", changeType: "unchanged" },
    additionalWedgeCount: { origin: "default", changeType: "unchanged" },
  },
};

describe("MonitoringEditor", () => {
  it("renders monitoring dropdown plus additional wedge toggle in setup layout primitives", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        effectiveMonitoring={baseMonitoring}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain("setup-editor-stack");
    expect(html).toContain("setup-field-control");
    expect(html).toContain('aria-label="Monitoring"');
    expect(html).toContain("setup-toggle-row");
    expect(html).toContain("Additional wedge monitor");
  });

  it("renders checked row and stepper when additional wedge is enabled", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        effectiveMonitoring={{ ...baseMonitoring, additionalWedgeCount: 2 }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain("setup-field-row setup-toggle-row setup-toggle-row--checked");
    expect(html).toContain('<span class="setup-toggle-row__text">Additional wedge monitor</span>');
    expect(html).toContain("setup-stepper__btn");
    expect(html).toContain("setup-stepper__value");
    expect(html).toContain('aria-label="Decrease additional wedges"');
  });

  it("exposes row-level toggle container and a propagation-safe stepper", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        effectiveMonitoring={{ ...baseMonitoring, additionalWedgeCount: 2 }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('class="setup-toggle-row__trailing"');
    expect(html).toContain('class="setup-stepper"');
    expect(html).toContain('<span class="setup-stepper__value"');
  });

  it("uses the shared toggle row text class instead of a label tag", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        effectiveMonitoring={{ ...baseMonitoring, additionalWedgeCount: 2 }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain('<span class="setup-toggle-row__text">Additional wedge monitor</span>');
    expect(html).not.toContain('<label class="setup-toggle-row__text"');
  });

  it("does not add modified field class when additional wedge is from defaults", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        effectiveMonitoring={{ ...baseMonitoring, additionalWedgeCount: 2 }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).not.toContain("setup-field-block setup-field-block--modified");
  });

  it("adds the shared modified field class when additional wedge origin is override", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        effectiveMonitoring={baseMonitoring}
        diffMeta={{
          ...baseDiffMeta,
          monitoring: {
            ...baseDiffMeta.monitoring,
            additionalWedgeCount: { origin: "override", changeType: "added" },
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
