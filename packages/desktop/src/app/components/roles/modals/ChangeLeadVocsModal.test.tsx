import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChangeLeadVocsModal } from "./ChangeLeadVocsModal";

describe("ChangeLeadVocsModal", () => {
  it("renders assignment editor headings, assigned order, and helper note", () => {
    const html = renderToStaticMarkup(
      <ChangeLeadVocsModal
        open
        suggestedCandidates={[
          {
            musicianId: "m1",
            displayName: "One",
            primaryGroup: "keys",
            source: "band_catalog",
            isSuggested: true,
            isSelected: true,
            hasVocalCapability: true,
            isInProjectLineup: false,
            reason: "vocal_capability",
          },
        ]}
        otherCandidates={[
          {
            musicianId: "m2",
            displayName: "Two",
            primaryGroup: "guitar",
            source: "project_lineup",
            isSuggested: false,
            isSelected: false,
            hasVocalCapability: false,
            isInProjectLineup: true,
            reason: "active_lineup_without_vocal_preset",
          },
        ]}
        initialSelectedIds={["m1"]}
        defaultSelectedIds={["m2"]}
        disabledSelectedIds={["m2"]}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Edit lead vocal assignments");
    expect(html).toContain("Assigned lead vocalists");
    expect(html).toContain("Add lead vocalists");
    expect(html).toContain("1. One");
    expect(html).toContain("Add another lead vocalist");
    expect(html).toContain("Reset to defaults");
    expect(html).toContain("cannot be selected as Back Vocal");
  });
});
