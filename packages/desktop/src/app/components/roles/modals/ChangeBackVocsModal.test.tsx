import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChangeBackVocsModal } from "./ChangeBackVocsModal";

describe("ChangeBackVocsModal", () => {
  it("renders only provided template musicians and initial selection", () => {
    const html = renderToStaticMarkup(
      <ChangeBackVocsModal
        open
        members={[
          { id: "m1", name: "One", primaryGroup: "bass", isDisabled: false },
          { id: "m2", name: "Two", primaryGroup: "keys", isDisabled: false },
        ]}
        initialSelectedIds={new Set(["m2"])}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("One");
    expect(html).toContain("(BASS)");
    expect(html).toContain("Two");
    expect(html).toContain("(KEYS)");
    expect(html).toContain("checked");
    expect(html).toContain("Select BACK VOCS");
    expect(html).toContain("cannot be selected as Back Vocs");
  });

  it("does not render the obsolete no-preset error message", () => {
    const html = renderToStaticMarkup(
      <ChangeBackVocsModal
        open
        members={[{ id: "m1", name: "One", primaryGroup: "vocs", isDisabled: false }]}
        initialSelectedIds={new Set()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).not.toContain("No back vocal preset is available.");
  });

  it("shows empty state and keeps save enabled when no candidates are available", () => {
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
    expect(html).toContain(">Save</button>");
    expect(html).not.toContain("disabled");
  });
});
