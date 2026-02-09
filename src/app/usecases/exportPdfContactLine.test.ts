import { describe, expect, it } from "vitest";
import type { Band } from "../../domain/model/types.js";
import { formatContactLine } from "./exportPdf.js";

describe("formatContactLine", () => {
  const band: Band = {
    id: "band-1",
    name: "Band",
    bandLeader: "leader-id",
    defaultLineup: {},
  };

  const contact = {
    id: "contact-1",
    firstName: "Alex",
    lastName: "Tester",
    phone: "+420731247870",
    email: "alex@example.com",
  };

  it("adds band leader suffix when contact matches band leader", () => {
    const line = formatContactLine({
      contact,
      band,
      contactMusicianId: "leader-id",
    });

    expect(line).toContain("(band leader)");
  });

  it("does not add band leader suffix for other musicians", () => {
    const line = formatContactLine({
      contact,
      band,
      contactMusicianId: "other-id",
    });

    expect(line).not.toContain("(band leader)");
  });

  it("does not add band leader suffix for external contacts", () => {
    const line = formatContactLine({
      contact,
      band,
    });

    expect(line).not.toContain("(band leader)");
  });
});
