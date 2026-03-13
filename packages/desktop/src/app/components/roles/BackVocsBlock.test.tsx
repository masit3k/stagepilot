import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BackVocsBlock } from "./BackVocsBlock";

describe("BackVocsBlock", () => {
  it("shows selected back vocal member names", () => {
    const html = renderToStaticMarkup(
      <BackVocsBlock
        members={[{ id: "m1", name: "One" }, { id: "m2", name: "Two" }]}
        onChange={vi.fn()}
        onSetup={vi.fn()}
      />,
    );

    expect(html).toContain("One");
    expect(html).toContain("Two");
    expect(html).not.toContain("Not selected");
  });

  it("renders a single section-level CTA pair", () => {
    const html = renderToStaticMarkup(
      <BackVocsBlock
        members={[{ id: "m1", name: "One" }, { id: "m2", name: "Two" }]}
        onChange={vi.fn()}
        onSetup={vi.fn()}
      />,
    );

    expect(html.match(/>Change</g)?.length ?? 0).toBe(1);
    expect(html.match(/>Setup</g)?.length ?? 0).toBe(1);
  });

  it("disables only setup when no back vocalists are selected", () => {
    const html = renderToStaticMarkup(
      <BackVocsBlock
        members={[]}
        onChange={vi.fn()}
        onSetup={vi.fn()}
        setupDisabled
      />,
    );

    expect(html).toContain("Not selected");
    expect(html).toContain("<button type=\"button\" class=\"button-secondary\">Change</button>");
    expect(html).toContain("<button type=\"button\" class=\"button-secondary\" disabled=\"\">Setup</button>");
  });
});
