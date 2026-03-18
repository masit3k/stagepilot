import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateBandsDefaultLineupVocs } from "./bandDefaultLineupVocsMigration";

const tempRoots: string[] = [];

async function createFixture(): Promise<{ root: string; bandsDir: string; musiciansDir: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-band-migrate-"));
  tempRoots.push(root);

  const bandsDir = path.join(root, "catalog", "bands");
  const musiciansDir = path.join(root, "catalog", "musicians");
  await fs.mkdir(bandsDir, { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "vocs"), { recursive: true });
  await fs.mkdir(path.join(musiciansDir, "keys"), { recursive: true });

  await fs.writeFile(path.join(musiciansDir, "vocs", "voc-1.json"), JSON.stringify({ id: "voc-1", group: "vocs" }));
  await fs.writeFile(path.join(musiciansDir, "vocs", "voc-2.json"), JSON.stringify({ id: "voc-2", group: "vocs" }));
  await fs.writeFile(path.join(musiciansDir, "keys", "keys-1.json"), JSON.stringify({ id: "keys-1", group: "keys" }));

  await fs.writeFile(
    path.join(bandsDir, "band-a.json"),
    JSON.stringify({
      id: "band-a",
      defaultLineup: {
        vocs: ["voc-1"],
        lead_vocs: ["voc-2", "keys-1"],
        back_vocs: ["voc-2", "missing"],
      },
    }),
  );

  await fs.writeFile(
    path.join(bandsDir, "band-b.json"),
    JSON.stringify({ id: "band-b", defaultLineup: { lead_vocs: ["keys-1"] } }),
  );

  return { root, bandsDir, musiciansDir };
}

afterEach(async () => {
  await Promise.all(tempRoots.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("migrateBandsDefaultLineupVocs", () => {
  it("adds only valid group=vocs selected lead/back ids and is idempotent", async () => {
    const fixture = await createFixture();

    const first = await migrateBandsDefaultLineupVocs({
      bandsRoot: fixture.bandsDir,
      musiciansRoot: fixture.musiciansDir,
      writeChanges: true,
    });
    const second = await migrateBandsDefaultLineupVocs({
      bandsRoot: fixture.bandsDir,
      musiciansRoot: fixture.musiciansDir,
      writeChanges: true,
    });

    const bandA = JSON.parse(await fs.readFile(path.join(fixture.bandsDir, "band-a.json"), "utf8")) as {
      defaultLineup: Record<string, unknown>;
    };

    expect(first.find((item) => item.bandId === "band-a")?.addedVocalMembers).toEqual(["voc-2"]);
    expect(bandA.defaultLineup.vocs).toEqual(["voc-1", "voc-2"]);
    expect(first.find((item) => item.bandId === "band-b")?.changed).toBe(false);
    expect(second.every((item) => !item.changed)).toBe(true);
  });
});
