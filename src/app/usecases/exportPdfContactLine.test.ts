import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadDefaultContact } from "./exportPdf.js";

// formatContactLine samotné je pokryté v ./formatContactLine.test.ts (R12/R13).
// Tady zůstává jen cesta přes soubor, protože loadDefaultContact zavádí
// runtimeRoot explicitně, ne z globálního USER_DATA_ROOT.
describe("loadDefaultContact", () => {
  it("resolves contact from the explicitly provided runtime root", async () => {
    const rootA = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-contact-a-"));
    await fs.mkdir(path.join(rootA, "catalog", "contacts"), { recursive: true });

    const contact = { id: "contact-1", firstName: "Explicit", lastName: "Root", phone: "+420731247870" };
    await fs.writeFile(path.join(rootA, "catalog", "contacts", "contact-1.json"), JSON.stringify(contact), "utf8");

    const result = await loadDefaultContact("contact-1", rootA);

    expect(result?.text).toContain("Explicit Root");

    await fs.rm(rootA, { recursive: true, force: true });
  });

  it("returns undefined when the band has no default contact", async () => {
    const result = await loadDefaultContact(undefined, "/unused-root");
    expect(result).toBeUndefined();
  });
});
