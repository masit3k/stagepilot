import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import { MonitoringEditor } from "./MonitoringEditor";

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
    expect(html).toContain("setup-toggle-row");
    expect(html).toContain("Additional wedge");
    expect(html).not.toContain("setup-monitoring-grid");
    expect(html).not.toContain("setup-field-control--compact");
  });

  it("renders checked row and compact count selector when additional wedge is set", () => {
    const html = renderToStaticMarkup(
      <MonitoringEditor
        effectiveMonitoring={{ ...baseMonitoring, additionalWedgeCount: 2 }}
        diffMeta={baseDiffMeta}
        onChangePatch={() => {}}
      />,
    );

    expect(html).toContain("setup-toggle-row setup-toggle-row--checked");
    expect(html).toContain("setup-field-control--compact");
    expect(html).toContain('aria-label="Additional wedge count"');
  });
});
