import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChangeBackVocsModal } from "./ChangeBackVocsModal";

describe("ChangeBackVocsModal", () => {
  it("renders assigned backing vocalists and assignment controls", () => {
    const html = renderToStaticMarkup(
      <ChangeBackVocsModal
        open
        suggestedCandidates={[
          {
            id: "m1",
            name: "One",
            primaryGroup: "bass",
            hasVocalCapability: true,
            isInProjectLineup: true,
            isDisabled: false,
          },
        ]}
        additionalCandidates={[
          {
            id: "m2",
            name: "Two",
            primaryGroup: "keys",
            hasVocalCapability: false,
            isInProjectLineup: true,
            isDisabled: false,
          },
        ]}
        initialSelectedIds={["m2"]}
        defaultSelectedIds={["m1"]}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Edit backing vocal assignments");
    expect(html).toContain("Assigned backing vocalists");
    expect(html).toContain("Add backing vocalists");
    expect(html).toContain("Two");
    expect(html).toContain("Add another backing vocalist");
    expect(html).toContain("Reset to defaults");
    expect(html).toContain("cannot be selected as Back Vocs");
  });

  it("does not render the obsolete no-preset error message", () => {
    const html = renderToStaticMarkup(
      <ChangeBackVocsModal
        open
        suggestedCandidates={[{
          id: "m1",
          name: "One",
          primaryGroup: "vocs",
          hasVocalCapability: true,
          isInProjectLineup: false,
          isDisabled: false,
        }]}
        additionalCandidates={[]}
        initialSelectedIds={[]}
        defaultSelectedIds={[]}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).not.toContain("No back vocal preset is available.");
  });

  it("shows empty assigned state and keeps save enabled when no candidates are available", () => {
    const html = renderToStaticMarkup(
      <ChangeBackVocsModal
        open
        suggestedCandidates={[]}
        additionalCandidates={[]}
        initialSelectedIds={[]}
        defaultSelectedIds={[]}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("No backing vocalist assigned");
    expect(html).toContain(">Save</button>");
    expect(html).not.toContain("disabled");
  });
});
