import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../../components/ui/toast/ToastProvider";
import { InputTable } from "../components/inputs/InputTable";
import type { InputEditorRow } from "../domain/inputs/buildInputEditorRows";
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

describe("InputTable (the INPUT LIST section's channel table)", () => {
  it("keeps a disabled row in place, with no channel number", () => {
    const rows: InputEditorRow[] = [
      {
        key: "el_bass_di",
        rawKey: "el_bass_di",
        ch: 1,
        label: "Bass DI",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        state: "active",
      },
      {
        key: "el_bass_mic",
        rawKey: "el_bass_mic",
        ch: null,
        label: "Bass mic",
        note: "",
        group: "bass",
        ownerRole: "bass",
        ownerMusicianId: "m1",
        slotKey: "bass:0",
        state: "removed",
      },
    ];

    const html = renderToStaticMarkup(
      <InputTable rows={rows} selectedKey={null} onSelect={() => undefined} />,
    );

    const removedRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Bass mic"));
    expect(removedRowHtml).toContain("inputRow--removed");
    expect(removedRowHtml).toContain("——");
    expect(removedRowHtml).not.toMatch(/inputRow__no">\d/);

    const activeRowHtml = html
      .split("<div")
      .find((chunk) => chunk.includes("Bass DI"));
    expect(activeRowHtml).not.toContain("inputRow--removed");
    expect(activeRowHtml).toContain('inputRow__no">1<');
  });
});
