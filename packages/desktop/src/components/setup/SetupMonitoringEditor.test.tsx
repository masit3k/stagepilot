import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Monitor } from "../../../../../src/domain/model/types";
import type { SetupDiffMeta } from "../../../../../src/domain/setup/computeSetupDiff";
import { SetupMonitoringEditor } from "./SetupMonitoringEditor";

const MONITORS: Monitor[] = [
  {
    type: "monitor",
    id: "wedge_foh",
    label: "Wedge",
    kind: "wedge",
    supplier: "foh",
  },
];

const effectiveMonitoring = { monitorRef: "wedge_foh" };

const diffMeta: SetupDiffMeta = {
  inputs: [],
  monitoring: {
    monitorRef: { origin: "default", changeType: "unchanged" },
    additionalWedgeCount: { origin: "default", changeType: "unchanged" },
  },
};

const noop = () => undefined;

describe("SetupMonitoringEditor (setup modal, screen 01)", () => {
  // Ruling (task 19a): mirrors task 15's `MonitorRowInspector` gate for the
  // R7 panel on screen 02 — `resolveEffectiveProjectSetup.ts:81-90` ignores a
  // drums slot's monitoring override, so the setup modal must not offer an
  // edit that silently never reaches the printed document.
  it("does not render the editor for a drums slot, and explains why", () => {
    const html = renderToStaticMarkup(
      <SetupMonitoringEditor
        slotKey="drums:0"
        ownerRole="drums"
        monitors={MONITORS}
        effectiveMonitoring={effectiveMonitoring}
        patch={undefined}
        diffMeta={diffMeta}
        onChangePatch={noop}
      />,
    );

    expect(html).not.toMatch(/<select/);
    expect(html).toContain("not editable here");
  });

  it("renders the editor for a guitar slot", () => {
    const html = renderToStaticMarkup(
      <SetupMonitoringEditor
        slotKey="guitar:0"
        ownerRole="guitar"
        monitors={MONITORS}
        effectiveMonitoring={effectiveMonitoring}
        patch={undefined}
        diffMeta={diffMeta}
        onChangePatch={noop}
      />,
    );

    expect(html).toMatch(/<select/);
    expect(html).not.toContain("not editable");
  });

  it("shows a no-slot hint instead of the editor when the slot key is empty", () => {
    const html = renderToStaticMarkup(
      <SetupMonitoringEditor
        slotKey=""
        ownerRole="bass"
        monitors={MONITORS}
        effectiveMonitoring={effectiveMonitoring}
        patch={undefined}
        diffMeta={diffMeta}
        onChangePatch={noop}
      />,
    );

    expect(html).not.toMatch(/<select/);
    expect(html).toContain("Not editable");
  });
});
