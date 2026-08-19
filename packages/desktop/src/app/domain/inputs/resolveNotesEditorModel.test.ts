import { describe, expect, it } from "vitest";
import { normalizeProject } from "../../../../../../src/app/usecases/normalizeProject";
import type {
  NotesTemplate,
  ProjectJson,
  ProjectNotesOverride,
} from "../../../../../../src/domain/model/types";
import {
  addCustomNote,
  commitTemplateNoteText,
  nextCustomNoteId,
  removeCustomNote,
  resolveNotesEditorModel,
  revertNoteToTemplate,
  setCustomNoteText,
  setNoteEnabled,
  setTemplateNoteText,
} from "./resolveNotesEditorModel";

// Explicit `NotesTemplate` annotation gives the `when.monitors.*` literals a
// contextual type — without it TS widens `true` to `boolean` across the
// array's mixed-shape elements and the literal fails to assign to `NoteLine`.
const template: NotesTemplate = {
  id: "t",
  lang: "cs",
  inputs: [{ id: "always", text: "Vždy" }],
  monitors: [
    { id: "plain", text: "Bez podmínky" },
    {
      id: "foh_iem",
      text: "FOH IEM",
      when: { monitors: { hasFohSuppliedIem: true } },
    },
  ],
};

const NOTHING = {
  hasWedge: false,
  hasBandSuppliedIem: false,
  hasFohSuppliedIem: false,
};

describe("resolveNotesEditorModel", () => {
  it("offers every template line, including ones a condition hides", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(model.monitors.map((line) => line.id)).toEqual(["plain", "foh_iem"]);
  });

  it("marks a condition-hidden line with a reason (R13)", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: undefined,
    });
    const hidden = model.monitors.find((line) => line.id === "foh_iem");

    expect(hidden?.hidden).toBe(true);
    expect(hidden?.hiddenReason).toBe("Hidden: band has no FOH-supplied IEM");
  });

  it("stops marking the line as hidden once the condition holds", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: { ...NOTHING, hasFohSuppliedIem: true },
      overrides: undefined,
    });

    expect(model.monitors.find((line) => line.id === "foh_iem")?.hidden).toBe(
      false,
    );
  });

  it("reports a disabled line as not enabled but still listed", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: { disabled: ["always"] },
    });

    expect(model.inputs[0].enabled).toBe(false);
    expect(model.inputs).toHaveLength(1);
  });

  it("shows the overridden text and flags it as edited (R12)", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: { overrides: { always: "Jiné znění." } },
    });

    expect(model.inputs[0].text).toBe("Jiné znění.");
    expect(model.inputs[0].edited).toBe(true);
  });

  it("does not flag an untouched line as edited", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(model.inputs[0].edited).toBe(false);
  });

  it("lists custom lines last in their own section", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: {
        custom: [{ id: "custom_1", section: "inputs", text: "Naše." }],
      },
    });

    expect(model.inputs.map((line) => [line.id, line.source])).toEqual([
      ["always", "template"],
      ["custom_1", "custom"],
    ]);
  });

  // --- Ruling 1 (dispatch notes): HIDDEN_REASON is derived from
  // `MonitorNoteContext`, and must report the reason in the same order
  // `matchesCondition` checks flags — hasWedge, then hasBandSuppliedIem,
  // then hasFohSuppliedIem. A note that fails on more than one flag must
  // report the first one in that order, not an arbitrary one.
  it("reports the first failing flag in matchesCondition's check order (Ruling 1)", () => {
    const multiConditionTemplate: NotesTemplate = {
      id: "t2",
      lang: "cs",
      inputs: [],
      monitors: [
        {
          id: "both",
          text: "Vyžaduje obojí",
          when: {
            monitors: { hasWedge: true, hasFohSuppliedIem: true },
          },
        },
      ],
    };

    const model = resolveNotesEditorModel({
      template: multiConditionTemplate,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(model.monitors[0].hiddenReason).toBe("Hidden: band uses no wedges");
  });

  it("reports the band-supplied-IEM reason for that flag (Ruling 1)", () => {
    const bandIemTemplate: NotesTemplate = {
      id: "t3",
      lang: "cs",
      inputs: [],
      monitors: [
        {
          id: "band_iem",
          text: "Vyžaduje IEM od kapely",
          when: { monitors: { hasBandSuppliedIem: true } },
        },
      ],
    };

    const model = resolveNotesEditorModel({
      template: bandIemTemplate,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(model.monitors[0].hiddenReason).toBe("Hidden: band brings no IEM");
  });

  // Minor (review): the earlier "first failing flag" test only pins
  // hasWedge before hasFohSuppliedIem — the two outer keys. Swapping the
  // two MIDDLE keys in `HIDDEN_REASON` (hasBandSuppliedIem <-> would-be
  // wedge/foh order) would still pass that test unchanged. This test
  // requires hasBandSuppliedIem and hasFohSuppliedIem together — it only
  // stays green if hasBandSuppliedIem is genuinely checked before
  // hasFohSuppliedIem, so a swap of the middle two keys flips it.
  it("checks hasBandSuppliedIem before hasFohSuppliedIem (Minor, review)", () => {
    const bothIemTemplate: NotesTemplate = {
      id: "t5",
      lang: "cs",
      inputs: [],
      monitors: [
        {
          id: "both_iem",
          text: "Vyžaduje obě IEM",
          when: {
            monitors: { hasBandSuppliedIem: true, hasFohSuppliedIem: true },
          },
        },
      ],
    };

    const model = resolveNotesEditorModel({
      template: bothIemTemplate,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(model.monitors[0].hiddenReason).toBe("Hidden: band brings no IEM");
  });

  // --- Important 1 (review): the brief's Krok 3 called `hiddenReasonFor`
  // for both sections, but `buildPdfNotes.ts` only ever runs
  // `matchesCondition` over `template.monitors` — `template.inputs` prints
  // unfiltered regardless of `when`. Marking an inputs line "hidden" would
  // tell the user it won't print when the document prints it anyway.
  it("never marks an inputs-section line as hidden, even with a when clause (Important 1, review)", () => {
    const conditionalInputTemplate: NotesTemplate = {
      id: "t6",
      lang: "cs",
      inputs: [
        {
          id: "conditional_input",
          text: "Podmíněný řádek v sekci inputs",
          when: { monitors: { hasWedge: true } },
        },
      ],
      monitors: [],
    };

    const model = resolveNotesEditorModel({
      template: conditionalInputTemplate,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(model.inputs[0].hidden).toBe(false);
    expect(model.inputs[0].hiddenReason).toBeNull();
  });
});

describe("nextCustomNoteId", () => {
  // --- Ruling 2 (dispatch notes): the lowest free number must be free
  // against ALL ids in the project — template ids and custom ids, in both
  // sections — not just against other custom entries. A collision between
  // a new custom id and an existing template id is not deduplicated
  // anywhere downstream, so it would silently duplicate instead of
  // overwriting.

  it("skips numbers already used by custom lines, reusing a freed gap", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: {
        custom: [
          { id: "custom_1", section: "inputs", text: "A" },
          { id: "custom_3", section: "monitors", text: "B" },
        ],
      },
    });

    expect(nextCustomNoteId(model)).toBe("custom_2");
  });

  it("skips a number already used by a template id, even with no custom lines yet", () => {
    const collidingTemplate: NotesTemplate = {
      id: "t4",
      lang: "cs",
      inputs: [{ id: "custom_1", text: "Šablonový řádek se koliduje jménem" }],
      monitors: [],
    };
    const model = resolveNotesEditorModel({
      template: collidingTemplate,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(nextCustomNoteId(model)).toBe("custom_2");
  });

  it("checks across both sections, not just the section being added to", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: {
        custom: [{ id: "custom_1", section: "monitors", text: "B" }],
      },
    });

    // Adding to "inputs" must still avoid "custom_1", taken in "monitors".
    expect(nextCustomNoteId(model)).toBe("custom_2");
  });
});

// --- Important 3 (review): the five override-mutation helpers were made
// testable pure functions specifically so they wouldn't have to be
// exercised only through the UI — this suite pins that promise, including
// `withOverrideFields`'s "empty collection collapses to `undefined`" rule,
// which decides whether a saved project carries noise or a clean absence.
describe("setNoteEnabled", () => {
  it("disables a line that has no prior overrides", () => {
    expect(setNoteEnabled(undefined, "always", false)).toEqual({
      disabled: ["always"],
    });
  });

  it("returns undefined once the last disabled line is enabled again (named case, review)", () => {
    const withDisabled = setNoteEnabled(undefined, "always", false);
    const reenabled = setNoteEnabled(withDisabled, "always", true);

    expect(reenabled).toBeUndefined();
  });

  it("re-enabling one id leaves other disabled ids untouched", () => {
    const bothDisabled = setNoteEnabled(
      setNoteEnabled(undefined, "always", false),
      "plain",
      false,
    );

    expect(setNoteEnabled(bothDisabled, "always", true)).toEqual({
      disabled: ["plain"],
    });
  });
});

describe("setTemplateNoteText", () => {
  it("writes the override text for the given id", () => {
    expect(setTemplateNoteText(undefined, "always", "Jiné.")).toEqual({
      overrides: { always: "Jiné." },
    });
  });

  it("keeps an existing override for another id", () => {
    const withOne = setTemplateNoteText(undefined, "always", "A");
    expect(setTemplateNoteText(withOne, "plain", "B")).toEqual({
      overrides: { always: "A", plain: "B" },
    });
  });
});

describe("revertNoteToTemplate", () => {
  it("returns undefined once the only overridden line is reverted (named case, review)", () => {
    const withOverride = setTemplateNoteText(undefined, "always", "Jiné.");

    expect(revertNoteToTemplate(withOverride, "always")).toBeUndefined();
  });

  it("reverts only the given id, keeping other overrides", () => {
    const both = setTemplateNoteText(
      setTemplateNoteText(undefined, "always", "A"),
      "plain",
      "B",
    );

    expect(revertNoteToTemplate(both, "always")).toEqual({
      overrides: { plain: "B" },
    });
  });
});

// --- Critical 1 (final fix wave): `normalizeProjectNotes`
// (`src/app/usecases/normalizeProject.ts`) drops an `overrides[id]` entry
// once its text trims to nothing — a user who selects a template note's
// text and deletes it gets an editor showing `text: "", edited: true` while
// the saved/rebuilt document keeps printing the template sentence. This is
// the sixth time this shape of bug closed the phase (12c, 13b, 15, 17, 16),
// so `commitTemplateNoteText` composes the SAME "empty text means no
// override" result the domain applies on save, and the last test below
// proves the two agree rather than assuming it.
describe("commitTemplateNoteText", () => {
  it("writes the override when the finished text is non-empty", () => {
    expect(commitTemplateNoteText(undefined, "always", "Jiné znění.")).toEqual({
      overrides: { always: "Jiné znění." },
    });
  });

  it("reverts to the template instead of writing a blank override", () => {
    const withOverride = setTemplateNoteText(undefined, "always", "Něco.");

    expect(commitTemplateNoteText(withOverride, "always", "")).toBeUndefined();
  });

  it("reverts on whitespace-only text too", () => {
    const withOverride = setTemplateNoteText(undefined, "always", "Něco.");

    expect(
      commitTemplateNoteText(withOverride, "always", "   "),
    ).toBeUndefined();
  });

  it("leaves other overrides untouched when reverting one id", () => {
    const both = setTemplateNoteText(
      setTemplateNoteText(undefined, "always", "A"),
      "plain",
      "B",
    );

    expect(commitTemplateNoteText(both, "always", "")).toEqual({
      overrides: { plain: "B" },
    });
  });

  it("matches what normalizeProject leaves behind on save, so the editor never shows text the document won't print (Critical 1)", () => {
    const emptiedOverride = setTemplateNoteText(undefined, "always", "Něco.");
    const committed = commitTemplateNoteText(emptiedOverride, "always", "");

    // The editor, rendered over the post-commit state, must show the
    // template line as untouched...
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: committed,
    });
    expect(model.inputs[0]).toMatchObject({
      text: "Vždy",
      edited: false,
    });

    // ...and that has to be exactly what a saved project normalizes to when
    // the very same emptied override reaches disk — not merely a similar
    // shape, the same `undefined`.
    const projectJson: ProjectJson = {
      id: "p1",
      bandRef: "b1",
      purpose: "generic",
      documentDate: "2026-01-01",
      notes: { overrides: { always: "" } },
    };
    expect(normalizeProject(projectJson).notes).toEqual(committed);
  });
});

describe("setCustomNoteText", () => {
  it("updates only the matching custom entry's text", () => {
    const overrides: ProjectNotesOverride = {
      custom: [
        { id: "custom_1", section: "inputs", text: "První." },
        { id: "custom_2", section: "inputs", text: "Druhá." },
      ],
    };

    expect(
      setCustomNoteText(overrides, "custom_2", "Přepsaná.")?.custom,
    ).toEqual([
      { id: "custom_1", section: "inputs", text: "První." },
      { id: "custom_2", section: "inputs", text: "Přepsaná." },
    ]);
  });
});

describe("addCustomNote", () => {
  it("adds a new custom line with the next free id in the given section", () => {
    const model = resolveNotesEditorModel({
      template,
      monitors: NOTHING,
      overrides: undefined,
    });

    expect(addCustomNote(undefined, model, "inputs")).toEqual({
      custom: [{ id: "custom_1", section: "inputs", text: "" }],
    });
  });
});

// --- Critical 1 (review): a custom line has no "disabled" path in
// `buildPdfNotes.ts` — `applySectionDeviations` never filters
// `overrides.custom` through `disabled`, so unchecking one would leave the
// document unchanged. Deleting the entry is the only real removal, and the
// only way to get rid of the empty line `addCustomNote` creates.
describe("removeCustomNote", () => {
  it("removes the entry from custom[], keeping the rest", () => {
    const overrides: ProjectNotesOverride = {
      custom: [
        { id: "custom_1", section: "inputs", text: "První." },
        { id: "custom_2", section: "inputs", text: "Druhá." },
      ],
    };

    expect(removeCustomNote(overrides, "custom_1")).toEqual({
      custom: [{ id: "custom_2", section: "inputs", text: "Druhá." }],
    });
  });

  it("returns undefined once the last custom line is removed", () => {
    const overrides: ProjectNotesOverride = {
      custom: [{ id: "custom_1", section: "inputs", text: "Jediná." }],
    };

    expect(removeCustomNote(overrides, "custom_1")).toBeUndefined();
  });
});
