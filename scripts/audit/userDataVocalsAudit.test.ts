import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runUserDataVocalAudit } from "./userDataVocalsAudit";

const tempRoots: string[] = [];

async function createAuditFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-audit-"));
  tempRoots.push(root);

  const bandsDir = path.join(root, "user_data", "bands");
  const musiciansDir = path.join(root, "user_data", "musicians");
  const presetsDir = path.join(root, "user_data", "presets", "groups");

  await fs.mkdir(path.join(bandsDir), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "vocs"), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "keys"), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "guitar"), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "bass"), { recursive: true });

  await fs.mkdir(path.join(presetsDir, "guitar"), { recursive: true });
  await fs.mkdir(path.join(presetsDir, "keys"), { recursive: true });
  await fs.mkdir(path.join(presetsDir, "vocs"), { recursive: true });

  await fs.writeFile(
    path.join(presetsDir, "guitar", "ac_guitar.json"),
    JSON.stringify({
      id: "ac_guitar",
      group: "guitar",
      type: "preset",
      inputs: [],
    }),
  );
  await fs.writeFile(
    path.join(presetsDir, "keys", "keys.json"),
    JSON.stringify({ id: "keys", group: "keys", type: "preset", inputs: [] }),
  );
  await fs.writeFile(
    path.join(presetsDir, "vocs", "vocal_lead_no_mic.json"),
    JSON.stringify({
      id: "vocal_lead_no_mic",
      group: "vocs",
      type: "preset",
      inputs: [],
    }),
  );

  const musicians = [
    {
      id: "voc-pure",
      firstName: "Pure",
      lastName: "Singer",
      group: "vocs",
      presets: [{ kind: "preset", ref: "vocal_lead_no_mic" }],
    },
    {
      id: "voc-instr",
      firstName: "Dual",
      lastName: "Role",
      group: "vocs",
      presets: [
        { kind: "preset", ref: "vocal_lead_no_mic" },
        { kind: "preset", ref: "ac_guitar" },
      ],
    },
    {
      id: "keys-lead",
      firstName: "Keys",
      lastName: "Lead",
      group: "keys",
      presets: [
        { kind: "preset", ref: "keys" },
        {
          kind: "vocal",
          ref: "vocal_lead_no_mic",
          ownerKey: "keys",
          ownerLabel: "keys",
        },
      ],
    },
    {
      id: "guitar-no-back",
      firstName: "Guitar",
      lastName: "NoBack",
      group: "guitar",
      presets: [{ kind: "preset", ref: "ac_guitar" }],
    },
    {
      id: "bass-only",
      firstName: "Bass",
      lastName: "Only",
      group: "bass",
      presets: [{ kind: "preset", ref: "mystery_ref" }],
    },
  ];

  for (const musician of musicians) {
    await fs.writeFile(
      path.join(musiciansDir, musician.group, `${musician.id}.json`),
      JSON.stringify(musician),
    );
  }

  await fs.writeFile(
    path.join(bandsDir, "band-a.json"),
    JSON.stringify({
      id: "band-a",
      name: "Band A",
      defaultLineup: {
        keys: ["keys-lead"],
        vocs: ["voc-pure"],
        lead_vocs: ["keys-lead"],
        back_vocs: ["guitar-no-back"],
      },
    }),
  );

  await fs.writeFile(
    path.join(bandsDir, "band-b.json"),
    JSON.stringify({
      id: "band-b",
      name: "Band B",
      defaultLineup: {
        bass: ["bass-only"],
        lead_vocs: ["missing-member"],
      },
    }),
  );

  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("runUserDataVocalAudit", () => {
  it("classifies pure vocalist", async () => {
    const root = await createAuditFixture();
    const report = await runUserDataVocalAudit(root);
    const musician = report.musicianClassifications.find(
      (item) => item.musicianId === "voc-pure",
    );
    expect(musician?.classification).toBe("pure_vocalist");
  });

  it("classifies vocalist with instrument", async () => {
    const root = await createAuditFixture();
    const report = await runUserDataVocalAudit(root);
    const musician = report.musicianClassifications.find(
      (item) => item.musicianId === "voc-instr",
    );
    expect(musician?.classification).toBe("vocalist_with_instrument");
  });

  it("classifies instrumentalist with lead capability", async () => {
    const root = await createAuditFixture();
    const report = await runUserDataVocalAudit(root);
    const musician = report.musicianClassifications.find(
      (item) => item.musicianId === "keys-lead",
    );
    expect(musician?.classification).toBe("instrumentalist_with_lead_vocal");
    expect(musician?.hasLeadCapability).toBe(true);
  });

  it("reports missing lineup member reference", async () => {
    const root = await createAuditFixture();
    const report = await runUserDataVocalAudit(root);
    const band = report.bands.find((item) => item.bandId === "band-b");
    expect(band?.invalidLeadSelectionIds).toContain("missing-member");
  });

  it("reports lead/back selected without capability", async () => {
    const root = await createAuditFixture();
    const report = await runUserDataVocalAudit(root);
    const band = report.bands.find((item) => item.bandId === "band-a");
    expect(band?.backWithoutCapability).toContain("guitar-no-back");
  });
});
