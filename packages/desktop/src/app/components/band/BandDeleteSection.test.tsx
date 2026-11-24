import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BandDeleteSection, BandUsageList } from "./BandDeleteSection";

describe("BandUsageList", () => {
  it("lists every blocking project with its label", () => {
    const html = renderToStaticMarkup(
      <BandUsageList
        projects={[
          {
            kind: "usesBand",
            file: "BK_Konopiste.json",
            displayName: "Konopiště",
            status: "archived",
          },
          { kind: "unreadable", file: "broken.json", message: "Invalid JSON" },
        ]}
      />,
    );

    expect(html).toContain("<li>Konopiště (archived)</li>");
    expect(html).toContain(
      "<li>broken.json — could not be checked (Invalid JSON)</li>",
    );
  });

  it("still explains the block when the list could not be read", () => {
    const html = renderToStaticMarkup(<BandUsageList projects={[]} />);

    expect(html).toContain("could not be listed");
    expect(html).not.toContain("<li>");
  });
});

describe("BandDeleteSection", () => {
  it("offers a destructive Delete band button and keeps the dialog closed", () => {
    const html = renderToStaticMarkup(
      <BandDeleteSection
        bandName="Test Band"
        onCheck={vi.fn()}
        onDelete={vi.fn()}
        onDeleted={vi.fn()}
        onFailed={vi.fn()}
      />,
    );

    expect(html).toContain(
      '<button type="button" class="button-danger">Delete band</button>',
    );
    expect(html).not.toContain("alertdialog");
  });
});
