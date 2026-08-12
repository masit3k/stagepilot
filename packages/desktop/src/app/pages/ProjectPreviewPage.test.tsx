import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast/ToastProvider";
import {
  ProjectPreviewPage,
  createPreviewRequestLifecycle,
} from "./ProjectPreviewPage";

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

    // The page reports a finished regeneration through a toast, so it needs the
    // provider — the same way it is composed in AppProviders.
    const html = renderToStaticMarkup(
      <ToastProvider>
        <ProjectPreviewPage
          id="test-id"
          navigate={() => undefined}
          registerNavigationGuard={() => undefined}
        />
      </ToastProvider>,
    );

    expect(html).toContain("Regenerate preview");
  });
});
