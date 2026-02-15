import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetupModalShell } from "./SetupModalShell";

describe("SetupModalShell", () => {
  it("renders a dedicated scroll container and sticky footer class", () => {
    const html = renderToStaticMarkup(
      <SetupModalShell
        open
        title="Setup"
        subtitle="Subtitle"
        onBack={() => {}}
        onReset={() => {}}
        onSave={() => {}}
      >
        <div>Body</div>
      </SetupModalShell>,
    );

    expect(html).toContain("setup-editor-body");
    expect(html).toContain("setup-modal-footer");
  });
});
