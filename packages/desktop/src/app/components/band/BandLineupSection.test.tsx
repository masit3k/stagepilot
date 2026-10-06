import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Group } from "../../../../../../src/domain/model/groups";
import type { Musician } from "../../../../../../src/domain/model/types";
import {
  type BandFormState,
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

function lineupForm(): BandFormState {
  let state = createEmptyBandForm();
  state = addMembersToGroup(state, "drums", ["plasil_pavel"]);
  state = addMembersToGroup(state, "bass", ["krecmer_matej"]);
  return addMembersToGroup(state, "vocs", ["krecmerova_eliska"]);
}

function renderSection(form: BandFormState): string {
  return renderToStaticMarkup(
    <BandLineupSection
      form={form}
      musicians={MUSICIANS}
      errors={[]}
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
    expect(html.match(/>Remove</g)?.length).toBe(3);
  });

  it("keeps only the add control in the actions column of every row", () => {
    const columns = actionColumns(renderSection(lineupForm()));

    expect(columns).toHaveLength(5);
    for (const column of columns) {
      expect(column.startsWith('<div class="lineup-multiselect">')).toBe(true);
    }
  });
});
