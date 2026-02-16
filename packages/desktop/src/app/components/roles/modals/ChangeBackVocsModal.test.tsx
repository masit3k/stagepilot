import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChangeBackVocsModal } from "./ChangeBackVocsModal";

describe("ChangeBackVocsModal", () => {
  it("renders only provided template musicians and initial selection", () => {
    const html = renderToStaticMarkup(
      <ChangeBackVocsModal
        open
        members={[{ id: "m1", name: "One" }, { id: "m2", name: "Two" }]}
        initialSelectedIds={new Set(["m2"])}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("One");
    expect(html).toContain("Two");
    expect(html).toContain("checked");
    expect(html).toContain("Select BACK VOCS");
  });

  it("disables save and shows error when no preset is available", () => {
    const html = renderToStaticMarkup(
      <ChangeBackVocsModal
        open
        members={[{ id: "m1", name: "One" }]}
        initialSelectedIds={new Set()}
        saveDisabled
        saveError="No back vocal preset is available."
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("disabled");
    expect(html).toContain("No back vocal preset is available.");
  });

  it("shows empty state and disables save when no candidates are available", () => {
    const html = renderToStaticMarkup(
      <ChangeBackVocsModal
        open
        members={[]}
        initialSelectedIds={new Set()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("No eligible vocalists available.");
    expect(html).toContain("disabled");
  });

});
