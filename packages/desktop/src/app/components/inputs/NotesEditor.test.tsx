import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NotesEditorLine } from "../../domain/inputs/resolveNotesEditorModel";
import { NotesEditor } from "./NotesEditor";

function makeLine(overrides: Partial<NotesEditorLine>): NotesEditorLine {
  return {
    id: "always",
    text: "Vždy",
    source: "template",
    enabled: true,
    edited: false,
    hidden: false,
    hiddenReason: null,
    ...overrides,
  };
}

// No assertions are ever made on these calls (renderToStaticMarkup never
// fires event handlers) — a plain no-op says that honestly, unlike
// `vi.fn()`, which implies a call gets checked somewhere.
const noop = () => {};

describe("NotesEditor", () => {
  it("renders both subsections with an Add note button each", () => {
    const html = renderToStaticMarkup(
      <NotesEditor
        model={{ inputs: [makeLine({})], monitors: [] }}
        onToggleEnabled={noop}
        onTextChange={noop}
        onTextBlur={noop}
        onRevertToTemplate={noop}
        onRemoveCustom={noop}
        onAddNote={noop}
      />,
    );

    expect(html).toContain("NOTES · INPUTS");
    expect(html).toContain("NOTES · MONITORS");
    expect(html.match(/\+ Add note/g)).toHaveLength(2);
  });

  it("shows a hidden line greyed out with its reason (R13)", () => {
    const html = renderToStaticMarkup(
      <NotesEditor
        model={{
          inputs: [],
          monitors: [
            makeLine({
              id: "foh_iem",
              text: "FOH IEM",
              hidden: true,
              hiddenReason: "Hidden: band has no FOH-supplied IEM",
            }),
          ],
        }}
        onToggleEnabled={noop}
        onTextChange={noop}
        onTextBlur={noop}
        onRevertToTemplate={noop}
        onRemoveCustom={noop}
        onAddNote={noop}
      />,
    );

    expect(html).toContain("notesEditorRow--hidden");
    expect(html).toContain("Hidden: band has no FOH-supplied IEM");
  });

  it("shows an edited badge and a Revert to template button for an overridden template line (R12)", () => {
    const html = renderToStaticMarkup(
      <NotesEditor
        model={{
          inputs: [makeLine({ text: "Jiné znění.", edited: true })],
          monitors: [],
        }}
        onToggleEnabled={noop}
        onTextChange={noop}
        onTextBlur={noop}
        onRevertToTemplate={noop}
        onRemoveCustom={noop}
        onAddNote={noop}
      />,
    );

    // Precise markup, not a loose substring match — "edited" alone would
    // also match if it showed up anywhere else in the row by coincidence.
    expect(html).toContain('<span class="notesEditorRow__badge">edited</span>');
    expect(html).toContain(">Revert to template<");
    expect(html).toContain("Jiné znění.");
  });

  it("shows a Remove button instead of a checkbox for a custom line, and never a Revert button (Critical 1, review)", () => {
    const html = renderToStaticMarkup(
      <NotesEditor
        model={{
          inputs: [
            makeLine({ id: "custom_1", source: "custom", text: "Naše." }),
          ],
          monitors: [],
        }}
        onToggleEnabled={noop}
        onTextChange={noop}
        onTextBlur={noop}
        onRevertToTemplate={noop}
        onRemoveCustom={noop}
        onAddNote={noop}
      />,
    );

    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain(">Remove<");
    expect(html).not.toContain("Revert to template");
  });

  it("renders an enabled template line's checkbox checked", () => {
    const html = renderToStaticMarkup(
      <NotesEditor
        model={{ inputs: [makeLine({ enabled: true })], monitors: [] }}
        onToggleEnabled={noop}
        onTextChange={noop}
        onTextBlur={noop}
        onRevertToTemplate={noop}
        onRemoveCustom={noop}
        onAddNote={noop}
      />,
    );

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
  });

  it("renders a disabled template line's checkbox unchecked", () => {
    const html = renderToStaticMarkup(
      <NotesEditor
        model={{ inputs: [makeLine({ enabled: false })], monitors: [] }}
        onToggleEnabled={noop}
        onTextChange={noop}
        onTextBlur={noop}
        onRevertToTemplate={noop}
        onRemoveCustom={noop}
        onAddNote={noop}
      />,
    );

    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('checked=""');
  });
});
