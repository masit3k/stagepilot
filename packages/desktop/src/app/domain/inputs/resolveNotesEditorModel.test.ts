import { describe, expect, it } from "vitest";
import type { NotesTemplate } from "../../../../../../src/domain/model/types";
import {
  nextCustomNoteId,
  resolveNotesEditorModel,
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
