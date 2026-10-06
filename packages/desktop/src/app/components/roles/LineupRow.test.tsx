import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineupRow } from "./LineupRow";

describe("LineupRow", () => {
  it("renders plain names without a name line when no name has an action", () => {
    const html = renderToStaticMarkup(
      <LineupRow
        roleLabel="DRUMS"
        names={[
          { key: "a", label: "One" },
          { key: "b", label: "Two" },
        ]}
      />,
    );

    expect(html).not.toContain("lineup-row__name-line");
    expect(html).toContain(
      '<div class="lineup-row__name"><span class="lineup-list__name">1. One</span><span class="lineup-list__name">2. Two</span></div>',
    );
  });

  it("puts a name's action on the same line as that name", () => {
    const html = renderToStaticMarkup(
      <LineupRow
        roleLabel="DRUMS"
        names={[
          {
            key: "a",
            label: "One",
            action: <button type="button">Remove</button>,
          },
        ]}
      />,
    );

    expect(html).toContain(
      '<div class="lineup-row__name-line"><span class="lineup-list__name">One</span><button type="button">Remove</button></div>',
    );
  });
});
