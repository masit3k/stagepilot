import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BackVocsBlock } from "./BackVocsBlock";

describe("BackVocsBlock", () => {
  it("shows selected back vocal member names", () => {
    const html = renderToStaticMarkup(
      <BackVocsBlock
        members={[{ id: "m1", name: "One" }, { id: "m2", name: "Two" }]}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("One");
    expect(html).toContain("Two");
    expect(html).not.toContain("Not selected");
  });
});
