import { describe, expect, it } from "vitest";
import { formatContactLine } from "./exportPdf.js";

const contact = {
  id: "c-1",
  firstName: "Matěj",
  lastName: "Krečmer",
  phone: "+420731247870",
  email: "matej@example.com",
};

describe("formatContactLine", () => {
  it("builds the header row with a middot separator", () => {
    expect(formatContactLine({ contact })).toEqual({
      text: "Kontaktní osoba · Matěj Krečmer · + 420 731 247 870",
      email: "matej@example.com",
    });
  });

  it("never marks the band leader (R13)", () => {
    // Kontaktní osoba nemusí být hudebník, takže označení není vždy
    // použitelné — a kapelnictví značí jediné místo, řádek v boxu (R9).
    expect(formatContactLine({ contact }).text).not.toContain("band leader");
  });

  it("drops missing parts together with their separator", () => {
    expect(
      formatContactLine({ contact: { id: "c-2", firstName: "Jana", lastName: "Nová" } }),
    ).toEqual({ text: "Kontaktní osoba · Jana Nová", email: null });
  });

  it("refuses a contact without any name", () => {
    expect(() =>
      formatContactLine({ contact: { id: "c-3", firstName: " ", lastName: "" } }),
    ).toThrow(/Invalid contact/);
  });
});
