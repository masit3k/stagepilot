import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectPreviewPage } from "./ProjectPreviewPage";

describe("ProjectPreviewPage", () => {
  it("renders explicit regenerate preview CTA in action bar", () => {
    vi.stubGlobal("window", {
      location: { pathname: "/projects/test-id/preview" },
    });

    const html = renderToStaticMarkup(
      <ProjectPreviewPage
        id="test-id"
        navigate={() => undefined}
        registerNavigationGuard={() => undefined}
      />,
    );

    expect(html).toContain("Regenerate preview");
  });
});
