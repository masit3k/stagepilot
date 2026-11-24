import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Group } from "../../../../../../src/domain/model/groups";
import type { Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
  type CanSing,
  addMembersToGroup,
  createEmptyBandForm,
} from "../../domain/band/bandFormModel";
import { BandLineupSection } from "./BandLineupSection";

function musician(
  id: string,
  group: Group,
  firstName: string,
  lastName: string,
): Musician {
  return { id, firstName, lastName, group, presets: [] };
}

const MUSICIANS: readonly Musician[] = [
  musician("plasil_pavel", "drums", "Pavel", "Plašil"),
  musician("krecmer_matej", "bass", "Matěj", "Krečmer"),
  musician("krecmerova_eliska", "vocs", "Eliška", "Krečmerová"),
  musician("holoubek_lukas", "vocs", "Lukáš", "Holoubek"),
];

/** Zpívá jen bubeník: BACK VOCS nové kapely = [Plašil]. */
const canSing: CanSing = (musicianId) => musicianId === "plasil_pavel";

function lineupForm(): BandFormState {
  let state = createEmptyBandForm();
  state = addMembersToGroup(state, "drums", ["plasil_pavel"], canSing);
  state = addMembersToGroup(state, "bass", ["krecmer_matej"], canSing);
  return addMembersToGroup(state, "vocs", ["krecmerova_eliska"], canSing);
}

function renderSection(form: BandFormState): string {
  return renderToStaticMarkup(
    <BandLineupSection
      form={form}
      musicians={MUSICIANS}
      errors={[]}
      canSing={canSing}
      onChange={vi.fn()}
    />,
  );
}

function actionColumns(html: string): string[] {
  return html.split('<div class="lineup-row__actions">').slice(1);
}

describe("BandLineupSection", () => {
  it("puts each member's Remove button on the member's own name line", () => {
    const html = renderSection(lineupForm());

    expect(html).toContain(
      '<div class="lineup-row__name-line"><span class="lineup-list__name">Plašil Pavel</span><button type="button" class="button-ghost" aria-label="Remove Plašil Pavel">Remove</button></div>',
    );
    expect(html.match(/>Remove</g)?.length).toBe(4);
  });

  it("keeps only the add control in the actions column of every row", () => {
    const columns = actionColumns(renderSection(lineupForm()));

    expect(columns).toHaveLength(6);
    for (const column of columns) {
      expect(column.startsWith('<div class="lineup-multiselect">')).toBe(true);
    }
  });

  it("labels the vocs group LEAD VOCS and offers Add lead vocs", () => {
    const html = renderSection(lineupForm());

    expect(html).toContain('<span class="lineup-row__role">LEAD VOCS</span>');
    expect(html).toContain("<span>Add lead vocs</span>");
    expect(html).not.toContain('<span class="lineup-row__role">VOCS</span>');
  });

  it("shows BACK VOCS right below LEAD VOCS with Remove next to each back vocalist", () => {
    const html = renderSection(lineupForm());

    expect(html.indexOf(">BACK VOCS<")).toBeGreaterThan(
      html.indexOf(">LEAD VOCS<"),
    );
    expect(html.match(/aria-label="Remove Plašil Pavel"/g)?.length).toBe(2);
    expect(html).toContain('id="band-add-back-vocs"');
    expect(html).toContain("<span>Add back vocs</span>");
  });

  it("shows an empty BACK VOCS row when nobody in the lineup sings", () => {
    const state = addMembersToGroup(
      createEmptyBandForm(),
      "bass",
      ["krecmer_matej"],
      () => false,
    );

    expect(renderSection(state)).toContain("No back vocals");
  });
});
