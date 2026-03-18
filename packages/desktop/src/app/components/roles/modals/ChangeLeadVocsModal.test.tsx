import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChangeLeadVocsModal } from "./ChangeLeadVocsModal";

describe("ChangeLeadVocsModal", () => {
  it("renders suggested and other sections with badges and helper note", () => {
    const html = renderToStaticMarkup(
      <ChangeLeadVocsModal
        open
        suggestedCandidates={[
          {
            musicianId: "m1",
            displayName: "One",
            primaryGroup: "keys",
            isSuggested: true,
            isSelected: true,
            hasLeadPreset: true,
          },
        ]}
        otherCandidates={[
          {
            musicianId: "m2",
            displayName: "Two",
            primaryGroup: "guitar",
            isSuggested: false,
            isSelected: false,
            hasLeadPreset: false,
          },
        ]}
        initialSelectedIds={new Set(["m1"])}
        disabledSelectedIds={new Set(["m2"])}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Suggested lead vocalists");
    expect(html).toContain("Other lineup members");
    expect(html).toContain("(KEYS)");
    expect(html).toContain("(GUITAR)");
    expect(html).toContain("Lead vocal preset");
    expect(html).toContain("checked");
    expect(html).toContain("cannot be selected as Back Vocs");
    expect(html).toContain('id="lead-vocs-m2"');
    expect(html).toContain("disabled");
  });
});
