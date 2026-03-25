import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateBandsDefaultLineupVocs } from "./bandDefaultLineupVocsMigration";

const tempRoots: string[] = [];

async function createFixture(): Promise<{ root: string; bandsDir: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stagepilot-band-migrate-"));
  tempRoots.push(root);

  const bandsDir = path.join(root, "catalog", "bands");
  await fs.mkdir(bandsDir, { recursive: true });

  await fs.writeFile(
    path.join(bandsDir, "band-a.json"),
    JSON.stringify({
      id: "band-a",
      defaultLineup: {
        vocs: ["voc-1"],
        keys: ["keys-1"],
      },
      defaultVocals: {
        lead: ["voc-1"],
        back: ["keys-1"],
      },
    }),
  );

  await fs.writeFile(
    path.join(bandsDir, "band-b.json"),
    JSON.stringify({ id: "band-b", defaultLineup: { lead_vocs: ["keys-1"] } }),
  );

  return { root, bandsDir };
}

afterEach(async () => {
  await Promise.all(tempRoots.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tempRoots.length = 0;
});

describe("migrateBandsDefaultLineupVocs", () => {
  it("validates canonical default lineup/defaultVocals model", async () => {
    const fixture = await createFixture();

    const results = await migrateBandsDefaultLineupVocs({
      bandsRoot: fixture.bandsDir,
    });
    const byId = new Map(results.map((result) => [result.bandId, result]));
    expect(byId.get("band-a")?.isValidCanonicalModel).toBe(true);
    expect(byId.get("band-a")?.issues).toEqual([]);
    expect(byId.get("band-b")?.isValidCanonicalModel).toBe(false);
    expect(byId.get("band-b")?.issues[0]).toContain(
      "Band must define defaultOverlays",
    );
  });

  it("flags lead/back overlap as canonical validation error", async () => {
    const fixture = await createFixture();
    await fs.writeFile(
      path.join(fixture.bandsDir, "band-c.json"),
      JSON.stringify({
        id: "band-c",
        defaultLineup: { vocs: ["voc-1"] },
        defaultVocals: { lead: ["voc-1"], back: ["voc-1"] },
      }),
    );
    const results = await migrateBandsDefaultLineupVocs({
      bandsRoot: fixture.bandsDir,
    });
    const issue = results.find((item) => item.bandId === "band-c")?.issues[0] ?? "";
    expect(issue).toContain("cannot be in both");
  });
});
