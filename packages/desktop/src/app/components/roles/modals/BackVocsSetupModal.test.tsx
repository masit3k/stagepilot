import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BackVocsSetupModal } from "./BackVocsSetupModal";

describe("BackVocsSetupModal", () => {
  it("renders selected vocalists", () => {
    const html = renderToStaticMarkup(
      <BackVocsSetupModal
        open
        items={[
          { musicianId: "a", name: "Anna", value: "vocal_back_no_mic", isModified: false },
          { musicianId: "b", name: "Boris", value: "vocal_back_wired", isModified: true },
        ]}
        onBack={vi.fn()}
        onReset={vi.fn()}
        onSave={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain("Anna");
    expect(html).toContain("Boris");
    expect(html).toContain("setup-field-block--modified");
    expect(html).toContain("Setup for this event – back vocalists");
    expect((html.match(/setup-field-control/g) ?? []).length).toBe(2);
  });
});
