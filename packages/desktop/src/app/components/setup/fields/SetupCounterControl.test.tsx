import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetupCounterControl } from "./SetupCounterControl";

describe("SetupCounterControl", () => {
  it("renders shared stepper controls with stable class contract", () => {
    const html = renderToStaticMarkup(
      <SetupCounterControl
        label="Kicks"
        value={1}
        min={1}
        max={2}
        onChange={() => {}}
      />,
    );

    expect(html).toContain('class="setup-stepper"');
    expect(html).toContain('class="setup-stepper__btn"');
    expect(html).toContain('class="setup-stepper__value"');
    expect(html).toContain('aria-label="Decrease Kicks"');
    expect(html).toContain('aria-label="Increase Kicks"');
  });
});
