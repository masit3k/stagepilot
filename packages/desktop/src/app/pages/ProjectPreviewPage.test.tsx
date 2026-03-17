import { describe, expect, it, vi } from "vitest";
import {
  createPreviewRequestLifecycle,
  ProjectPreviewPage,
} from "./ProjectPreviewPage";
import { renderToStaticMarkup } from "react-dom/server";

describe("preview request lifecycle", () => {
  it("accepts one request at a time", () => {
    const lifecycle = createPreviewRequestLifecycle();

    const first = lifecycle.startRequest();
    const second = lifecycle.startRequest();

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
  });

  it("treats old request ids as stale after a new accepted request", () => {
    const lifecycle = createPreviewRequestLifecycle();

    const first = lifecycle.startRequest();
    lifecycle.finishRequest(first.requestId);
    const second = lifecycle.startRequest();

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(lifecycle.isCurrentRequest(first.requestId)).toBe(false);
    expect(lifecycle.isCurrentRequest(second.requestId)).toBe(true);
  });

  it("invalidates request ids on cleanup", () => {
    const lifecycle = createPreviewRequestLifecycle();

    const first = lifecycle.startRequest();
    lifecycle.invalidateRequests();

    expect(first.accepted).toBe(true);
    expect(lifecycle.isCurrentRequest(first.requestId)).toBe(false);

    const next = lifecycle.startRequest();
    expect(next.accepted).toBe(true);
    expect(lifecycle.isCurrentRequest(next.requestId)).toBe(true);
  });
});

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
