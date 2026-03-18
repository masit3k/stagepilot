import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Band } from "../../domain/model/types.js";
import type { DataRepository } from "../../infra/fs/repo.js";
import { formatContactLine, loadDefaultContactLine } from "./exportPdf.js";

describe("formatContactLine", () => {
  const band: Band = {
    id: "band-1",
    name: "Band",
    bandLeader: "leader-id",
    defaultLineup: {},
    defaultVocals: { lead: [], back: [] },
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


describe("loadDefaultContactLine", () => {
  it("resolves contact from the explicitly provided runtime root", async () => {
    const rootA = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-contact-a-"));
    await fs.mkdir(path.join(rootA, "catalog", "contacts"), { recursive: true });

    const contact = { id: "contact-1", firstName: "Explicit", lastName: "Root", phone: "+420731247870" };
    await fs.writeFile(path.join(rootA, "catalog", "contacts", "contact-1.json"), JSON.stringify(contact), "utf8");

    const band: Band = {
      id: "band-1",
      name: "Band",
      bandLeader: "leader-id",
      defaultLineup: {},
      defaultVocals: { lead: [], back: [] },
    };
    const repo: DataRepository = {
      getBand: () => { throw new Error("not used"); },
      getMusician: () => { throw new Error("not found"); },
      getProject: () => { throw new Error("not used"); },
      getPreset: () => { throw new Error("not used"); },
      getNotesTemplate: () => { throw new Error("not used"); },
    };

    const line = await loadDefaultContactLine("contact-1", band, repo, rootA);

    expect(line).toContain("Explicit Root");

    await fs.rm(rootA, { recursive: true, force: true });
  });
});
