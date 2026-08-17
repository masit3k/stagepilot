import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../../components/ui/toast/ToastProvider";
import { ProjectInputsPage, isInputsDirty } from "./ProjectInputsPage";

describe("isInputsDirty", () => {
  const empty = { inputOrder: undefined, notes: undefined, lineup: {} };

  it("is clean when nothing changed", () => {
    expect(isInputsDirty(empty, empty)).toBe(false);
  });

  it("is dirty once a manual order appears", () => {
    expect(isInputsDirty(empty, { ...empty, inputOrder: ["kick_in"] })).toBe(
      true,
    );
  });

  it("is dirty once notes deviate", () => {
    expect(isInputsDirty(empty, { ...empty, notes: { disabled: ["x"] } })).toBe(
      true,
    );
  });

  it("is dirty when a slot patch changed", () => {
    expect(
      isInputsDirty(empty, {
        ...empty,
        lineup: {
          bass: [
            { musicianId: "m1", presetOverride: { inputs: { remove: ["x"] } } },
          ],
        },
      }),
    ).toBe(true);
  });

  it("is clean when both snapshots carry equal notes deviations", () => {
    expect(
      isInputsDirty(
        { ...empty, notes: { disabled: ["a", "b"] } },
        { ...empty, notes: { disabled: ["a", "b"] } },
      ),
    ).toBe(false);
  });
});

describe("ProjectInputsPage", () => {
  it("renders the three document sections", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <ProjectInputsPage
          id="p1"
          navigate={() => undefined}
          registerNavigationGuard={() => () => undefined}
        />
      </ToastProvider>,
    );

    expect(html).toContain("INPUT LIST");
    expect(html).toContain("MONITORS");
    expect(html).toContain("NOTES");
  });
});
